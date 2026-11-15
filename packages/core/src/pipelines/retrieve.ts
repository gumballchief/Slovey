import { getDb, decisions } from "@company-brain/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getAI } from "../ai";
import { CATEGORIES, categorizePrompt, type Category } from "../ai/prompts";
import type { JudgePrInput } from "../ai/prompts";
import { tryEmbed } from "../embeddings/try";
import { lexicalDistance, lexicalTerms } from "./lexical";

export interface RetrievedDecision {
  id: string;
  decision: string;
  why: string;
  examples: string[];
  evidence: string[];
  category: string | null;
  distance: number;
}

/** Classify the PR (cheap model) into one of the fixed categories. */
export async function categorizePr(pr: JudgePrInput): Promise<Category | null> {
  const r = await getAI().completeJSON<{ category: string }>(categorizePrompt(pr), {
    tier: "cheap",
    maxTokens: 50,
  });
  const c = r?.category as Category | undefined;
  return c && (CATEGORIES as readonly string[]).includes(c) ? c : null;
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

const KEYWORD_STOPWORDS = new Set([
  "with",
  "from",
  "this",
  "that",
  "have",
  "will",
  "your",
  "about",
  "into",
  "update",
  "change",
  "files",
  "added",
  "docs",
  "test",
  "tests",
]);

/** Distinctive alphanumeric terms from untrusted PR text for keyword backstop. */
export function extractQueryKeywords(pr: JudgePrInput, maxTerms = 10): string[] {
  // Reuse the capped retrieval query so multi-megabyte bodies/diffs cannot
  // force a full lowercased copy + huge token array here. The diff tail is
  // sampled too (bounded), so padding in front cannot hide the real change.
  const diff = pr.diffSummary ?? "";
  const tail = diff.length > 4000 ? diff.slice(-4000) : "";
  const text = `${tail}\n${buildRetrievalQueryText(pr)}`.toLowerCase();
  const tokens = text
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !KEYWORD_STOPWORDS.has(t));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= maxTerms) break;
    }
  }
  return out;
}

/** Union pools deduped by id, keeping the first (closest) copy. */
export function unionDecisionPools<T extends { id: string }>(...pools: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const pool of pools) {
    for (const r of pool) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
  }
  return [...byId.values()];
}

/** Max total chars sent to the embedding provider for retrieval. */
export const RETRIEVAL_QUERY_MAX_CHARS = 8000;

/** Build the embedding query with per-field caps so huge diffs cannot overflow provider limits. */
export function buildRetrievalQueryText(pr: JudgePrInput): string {
  const title = (pr.title ?? "").slice(0, 500);
  const body = (pr.body ?? "").slice(0, 2000);
  const files = (pr.changedFiles ?? []).join(" ").slice(0, 2000);
  const diff = (pr.diffSummary ?? "").slice(0, 4000);
  // Diff first: title/body/file padding cannot push it out of the budget.
  return [diff, title, body, files].filter(Boolean).join("\n").slice(0, RETRIEVAL_QUERY_MAX_CHARS);
}

/**
 * Smarter retrieval: categorize → query-embed (title+body+paths+diff) → pgvector
 * cosine top-K over the repo's ACTIVE decisions (human-approved + AI-proposed),
 * with a category boost. Candidates (unverified) are excluded. Keeps the judge
 * prompt small and improves recall on real matches.
 */
export async function retrieveDecisions(
  repoId: string,
  pr: JudgePrInput & { category?: Category | null },
  opts: { topK?: number; pool?: number } = {},
): Promise<RetrievedDecision[]> {
  const topK = opts.topK ?? 8;
  const pool = opts.pool ?? Math.max(topK * 3, 24);

  const queryText = buildRetrievalQueryText(pr);

  const vec = await tryEmbed(queryText);
  if (!vec) return retrieveDecisionsByKeyword(repoId, pr, queryText, topK);
  const lit = toVectorLiteral(vec);
  const db = getDb();

  const rows = await db
    .select({
      id: decisions.id,
      decision: decisions.decision,
      why: decisions.why,
      examples: decisions.examples,
      evidence: decisions.evidence,
      category: decisions.category,
      distance: sql<number>`(${decisions.embedding} <=> ${lit}::vector)`,
    })
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, repoId),
        // human-approved + AI-proposed both govern; candidates are excluded.
        inArray(decisions.status, ["approved", "proposed"]),
        // only rows that actually have an embedding
        sql`${decisions.embedding} is not null`,
      ),
    )
    .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
    .limit(pool);

  const extraPools: (typeof rows)[] = [];

  // Per-category backstop: same-category nearest neighbours cannot be evicted
  // by benign-topic dilution in the global cosine pool.
  if (pr.category) {
    const catRows = await db
      .select({
        id: decisions.id,
        decision: decisions.decision,
        why: decisions.why,
        examples: decisions.examples,
        evidence: decisions.evidence,
        category: decisions.category,
        distance: sql<number>`(${decisions.embedding} <=> ${lit}::vector)`,
      })
      .from(decisions)
      .where(
        and(
          eq(decisions.repoId, repoId),
          inArray(decisions.status, ["approved", "proposed"]),
          sql`${decisions.embedding} is not null`,
          eq(decisions.category, pr.category),
        ),
      )
      .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
      .limit(topK);
    extraPools.push(catRows);
  }

  // Keyword / file-overlap backstop: terms from the (untrusted) PR text matched
  // against stored decision text, so stuffing cannot evict the true match.
  const keywords = extractQueryKeywords(pr);
  if (keywords.length > 0) {
    const kwFilter = or(...keywords.map((k) => ilike(decisions.decision, `%${k}%`)));
    if (kwFilter !== undefined) {
      const kwRows = await db
        .select({
          id: decisions.id,
          decision: decisions.decision,
          why: decisions.why,
          examples: decisions.examples,
          evidence: decisions.evidence,
          category: decisions.category,
          distance: sql<number>`(${decisions.embedding} <=> ${lit}::vector)`,
        })
        .from(decisions)
        .where(
          and(
            eq(decisions.repoId, repoId),
            inArray(decisions.status, ["approved", "proposed"]),
            sql`${decisions.embedding} is not null`,
            kwFilter,
          ),
        )
        .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
        .limit(Math.max(topK, 10));
      extraPools.push(kwRows);
    }
  }

  const all = unionDecisionPools(rows, ...extraPools);

  // Category boost: nudge same-category decisions up, then take top-K.
  const boosted = all
    .map((r) => ({
      ...r,
      examples: r.examples ?? [],
      evidence: r.evidence ?? [],
      effective: pr.category && r.category === pr.category ? r.distance * 0.8 : r.distance,
    }))
    .sort((a, b) => a.effective - b.effective)
    .slice(0, topK);

  return boosted.map(({ effective: _e, ...rest }) => rest);
}

/** Most active decisions a repo can have scanned in keyword mode. */
const KEYWORD_SCAN_LIMIT = 500;

/**
 * Embeddings are down: score the repo's active decisions by keyword overlap
 * instead (rows without a vector included), same category boost, same top-K.
 * The AI judge still decides whether each one actually conflicts.
 */
async function retrieveDecisionsByKeyword(
  repoId: string,
  pr: JudgePrInput & { category?: Category | null },
  queryText: string,
  topK: number,
): Promise<RetrievedDecision[]> {
  const rows = await getDb()
    .select({
      id: decisions.id,
      decision: decisions.decision,
      why: decisions.why,
      examples: decisions.examples,
      evidence: decisions.evidence,
      category: decisions.category,
    })
    .from(decisions)
    .where(and(eq(decisions.repoId, repoId), inArray(decisions.status, ["approved", "proposed"])))
    .orderBy(desc(decisions.updatedAt))
    .limit(KEYWORD_SCAN_LIMIT);

  const diff = pr.diffSummary ?? "";
  const query = lexicalTerms(`${queryText}\n${diff.length > 4000 ? diff.slice(-4000) : ""}`);
  return rows
    .map((r) => {
      const distance = lexicalDistance(
        query,
        lexicalTerms([r.decision, r.why, (r.examples ?? []).join(" ")].join("\n")),
      );
      return {
        ...r,
        examples: r.examples ?? [],
        evidence: r.evidence ?? [],
        distance,
        effective: pr.category && r.category === pr.category ? distance * 0.8 : distance,
      };
    })
    .sort((a, b) => a.effective - b.effective)
    .slice(0, topK)
    .map(({ effective: _e, ...rest }) => rest);
}
