import { getDb, decisions } from "@company-brain/db";
import { eq, sql } from "drizzle-orm";
import { getAI } from "../ai";
import { consolidatePrompt, extractDocPrompt, extractPrompt, filterExtractedDecisionsToBatch } from "../ai/prompts";
import type { ExtractedDecision } from "../ai/types";
import { getInstallationOctokit } from "../github/app";
import { buildPrBatchText, fetchClosedPRs, fetchDocs } from "../github/fetchers";
import { decisionHeadroom, isRepoWithinPlan } from "../services/plan-guard";
import { upsertDecisions } from "./upsert-decisions";

const PR_BATCH = 8;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** Coerce evidence into a clean string[] (LLM sometimes returns a string). */
function normalizeEvidence(ev: unknown): string[] {
  if (Array.isArray(ev)) return uniq(ev.map((x) => String(x).trim()));
  if (typeof ev === "string") return uniq(ev.split(",").map((s) => s.trim()));
  return [];
}

export interface ExtractParams {
  repoId: string;
  installationId: number;
  owner: string;
  name: string;
  defaultBranch: string;
  prLimit?: number;
}

export interface ExtractResult {
  prsFetched: number;
  extracted: number;
  droppedEmptyEvidence: number;
  consolidated: number;
  docDecisions: number;
  inserted: number;
  updated: number;
  aborted?: string;
}

async function countDecisions(repoId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(decisions)
    .where(eq(decisions.repoId, repoId));
  return row?.n ?? 0;
}

/**
 * Build/refresh a repo's memory:
 *   fetch closed PRs (+discussion) → LLM extract → drop empty-evidence →
 *   consolidate → ingest Layer-2 docs → embed → upsert with pgvector dedup.
 * Safety rails: never store a decision without evidence; never wipe a rich
 * memory with an empty-ish rebuild.
 */
export async function runExtract(params: ExtractParams): Promise<ExtractResult> {
  // Plan enforcement: repos beyond the org's allowance don't build memory
  // (extraction is the expensive AI path).
  const gate = await isRepoWithinPlan(params.repoId);
  if (!gate.ok) {
    return {
      prsFetched: 0, extracted: 0, droppedEmptyEvidence: 0, consolidated: 0,
      docDecisions: 0, inserted: 0, updated: 0,
      aborted: `plan-limit (${gate.plan}: ${gate.limit} repos)`,
    };
  }

  const ai = getAI();
  const octokit = await getInstallationOctokit(params.installationId);

  // 1. Closed PRs (merged + rejected) with discussion.
  const prs = await fetchClosedPRs(octokit, params.owner, params.name, {
    limit: params.prLimit ?? 60,
  });

  // 2. Extract decisions in batches (cheap model).
  const raw: ExtractedDecision[] = [];
  for (const batch of chunk(prs, PR_BATCH)) {
    const res = await ai.completeJSON<ExtractedDecision[]>(
      extractPrompt(buildPrBatchText(batch)),
      { tier: "cheap", maxTokens: 4000 },
    );
    if (Array.isArray(res)) {
      // Keep only citations of PRs that were really in this batch, so text inside a PR
      // cannot plant a decision that cites some other PR.
      const realIds = batch.map((pr) => pr.number);
      const cleaned = res.filter((d) => d && typeof d === "object").map((d) => ({ ...d, evidence: normalizeEvidence(d.evidence) }));
      raw.push(...filterExtractedDecisionsToBatch(cleaned, realIds));
    }
  }

  // 3. Guardrail: drop any decision without evidence (never invent).
  const grounded = raw.filter((d) => d.decision && d.evidence.length > 0);
  const droppedEmptyEvidence = raw.length - grounded.length;

  // 4. Consolidate semantically-equivalent decisions.
  let consolidated = grounded;
  if (grounded.length > 1) {
    const res = await ai.completeJSON<ExtractedDecision[]>(consolidatePrompt(grounded), {
      tier: "cheap",
      maxTokens: 4000,
    });
    if (Array.isArray(res) && res.length > 0) {
      const cleaned = res
        .filter((d) => d && typeof d === "object")
        .map((d) => ({ ...d, evidence: normalizeEvidence(d.evidence) }))
        .filter((d) => d.decision && d.evidence.length > 0);
      // Re-apply the batch-citation guardrail: consolidation must not invent
      // citations (e.g. "PR #999999") or re-ground decisions in other PRs.
      const groundedIds = grounded.flatMap((d) => d.evidence);
      consolidated = filterExtractedDecisionsToBatch(cleaned, groundedIds);
    }
  }

  // 5. Layer-2 docs → decisions cited by file path.
  const docDecisions: ExtractedDecision[] = [];
  try {
    const docs = await fetchDocs(octokit, params.owner, params.name, params.defaultBranch);
    for (const doc of docs) {
      const res = await ai.completeJSON<ExtractedDecision[]>(
        extractDocPrompt(`### ${doc.path}\n${doc.content}`),
        { tier: "cheap", maxTokens: 2000 },
      );
      if (Array.isArray(res)) {
        for (const d of res) {
          if (d?.decision) docDecisions.push({ ...d, evidence: [doc.path] });
        }
      }
    }
  } catch {
    // docs are best-effort
  }

  // 6. Safety: don't wipe an existing rich memory with an empty rebuild.
  if (consolidated.length + docDecisions.length === 0) {
    const existing = await countDecisions(params.repoId);
    if (existing > 3) {
      return {
        prsFetched: prs.length,
        extracted: grounded.length,
        droppedEmptyEvidence,
        consolidated: 0,
        docDecisions: 0,
        inserted: 0,
        updated: 0,
        aborted: "empty-rebuild-protected",
      };
    }
  }

  // 7. Plan enforcement: don't exceed the org's decision allowance.
  const items = [
    ...consolidated.map((d) => ({ d, source: "github_pr" as const })),
    ...docDecisions.map((d) => ({ d, source: "doc" as const })),
  ];
  const headroom = await decisionHeadroom(params.repoId, items.length);
  let toUpsert = items;
  if (!headroom.ok) {
    const allowed = headroom.limit < 0 ? items.length : Math.max(0, headroom.limit - headroom.used);
    if (allowed <= 0) {
      return {
        prsFetched: prs.length,
        extracted: grounded.length,
        droppedEmptyEvidence,
        consolidated: consolidated.length,
        docDecisions: docDecisions.length,
        inserted: 0,
        updated: 0,
        aborted: `plan-limit (${headroom.plan}: ${headroom.limit} decisions)`,
      };
    }
    toUpsert = items.slice(0, allowed);
  }

  // 7. Embed + upsert with pgvector dedup (refresh updates rather than duplicates).
  const { inserted, updated } = await upsertDecisions(params.repoId, toUpsert);

  return {
    prsFetched: prs.length,
    extracted: grounded.length,
    droppedEmptyEvidence,
    consolidated: consolidated.length,
    docDecisions: docDecisions.length,
    inserted,
    updated,
  };
}
