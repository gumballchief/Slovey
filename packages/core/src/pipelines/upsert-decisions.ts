import { decisions, getDb } from "@company-brain/db";
import { and, eq, sql } from "drizzle-orm";
import type { ExtractedDecision } from "../ai/types";
import { getEmbeddings } from "../embeddings";

/** Cosine distance below which two decisions are treated as the same (merge). */
export const DEDUP_DISTANCE = 0.15;

/** The pg enum union for decisions.source (github_pr | doc | repo_analysis | …). */
export type DecisionSource = (typeof decisions.$inferInsert)["source"];

export interface UpsertItem {
  d: ExtractedDecision;
  source: DecisionSource;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/**
 * Embed each decision and upsert it with pgvector dedup: if a near-duplicate
 * already exists for the repo (cosine distance < DEDUP_DISTANCE) merge evidence +
 * examples into it; otherwise insert. Shared by the extract and repo-analysis
 * pipelines so structural conventions flow through the same memory + dedup path.
 */
export async function upsertDecisions(
  repoId: string,
  items: UpsertItem[],
  createdBy = "extract",
): Promise<{ inserted: number; updated: number }> {
  const db = getDb();
  const emb = getEmbeddings();
  let inserted = 0;
  let updated = 0;

  // Collapse items the LLM emitted with the same decision text (it sometimes
  // returns the same decision twice with different rationale). The pgvector
  // dedup below embeds decision+why+examples, so differing rationale would slip
  // through as duplicates — merge their evidence/examples up front.
  const merged = new Map<string, UpsertItem>();
  for (const item of items) {
    const key = item.d.decision.trim().toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.d.evidence = uniq([...existing.d.evidence, ...item.d.evidence]);
      existing.d.examples = uniq([...(existing.d.examples ?? []), ...(item.d.examples ?? [])]);
    } else {
      merged.set(key, {
        source: item.source,
        d: {
          ...item.d,
          evidence: [...item.d.evidence],
          examples: [...(item.d.examples ?? [])],
        },
      });
    }
  }

  for (const { d, source } of merged.values()) {
    const text = [d.decision, d.why, (d.examples ?? []).join(" ")].filter(Boolean).join("\n");
    const vec = await emb.embedOne(text);
    const lit = `[${vec.join(",")}]`;

    const [near] = await db
      .select({
        id: decisions.id,
        evidence: decisions.evidence,
        examples: decisions.examples,
        distance: sql<number>`(${decisions.embedding} <=> ${lit}::vector)`,
      })
      .from(decisions)
      .where(and(eq(decisions.repoId, repoId), sql`${decisions.embedding} is not null`))
      .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
      .limit(1);

    if (near && near.distance < DEDUP_DISTANCE) {
      await db
        .update(decisions)
        .set({
          decision: d.decision,
          why: d.why ?? "",
          examples: uniq([...(near.examples ?? []), ...(d.examples ?? [])]),
          evidence: uniq([...(near.evidence ?? []), ...d.evidence]),
          category: d.category ?? null,
          embedding: vec,
          updatedAt: new Date(),
        })
        .where(eq(decisions.id, near.id));
      updated++;
    } else {
      await db.insert(decisions).values({
        repoId,
        decision: d.decision,
        why: d.why ?? "",
        examples: d.examples ?? [],
        evidence: d.evidence,
        source,
        category: d.category ?? null,
        status: "approved",
        embedding: vec,
        createdBy,
      });
      inserted++;
    }
  }
  return { inserted, updated };
}
