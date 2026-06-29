import { getDb, decisions } from "@company-brain/db";
import { and, eq, sql } from "drizzle-orm";
import { getAI } from "../ai";
import { CATEGORIES, categorizePrompt, type Category } from "../ai/prompts";
import type { JudgePrInput } from "../ai/prompts";
import { getEmbeddings } from "../embeddings";

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

/**
 * Smarter retrieval: categorize → query-embed (title+body+paths+diff) → pgvector
 * cosine top-K over the repo's APPROVED decisions, with a category boost. Keeps
 * the judge prompt small and improves recall on real matches.
 */
export async function retrieveDecisions(
  repoId: string,
  pr: JudgePrInput & { category?: Category | null },
  opts: { topK?: number; pool?: number } = {},
): Promise<RetrievedDecision[]> {
  const topK = opts.topK ?? 8;
  const pool = opts.pool ?? Math.max(topK * 3, 24);

  const queryText = [
    pr.title,
    pr.body,
    (pr.changedFiles ?? []).join(" "),
    pr.diffSummary ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const vec = await getEmbeddings().embedOne(queryText);
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
        eq(decisions.status, "approved"),
        // only rows that actually have an embedding
        sql`${decisions.embedding} is not null`,
      ),
    )
    .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
    .limit(pool);

  // Category boost: nudge same-category decisions up, then take top-K.
  const boosted = rows
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
