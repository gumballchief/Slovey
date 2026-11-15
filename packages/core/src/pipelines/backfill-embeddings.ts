import { decisions, getDb } from "@company-brain/db";
import { eq, sql } from "drizzle-orm";
import { tryEmbed } from "../embeddings/try";

/**
 * Decisions saved while the embedding provider was down have no vector, so
 * semantic search cannot see them. Embed them once it is back. Stops at the
 * first failure (provider still down) and picks up again on the next run.
 */
export async function backfillMissingEmbeddings(limit = 200): Promise<{ filled: number; remaining: boolean }> {
  const db = getDb();
  const rows = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      decision: decisions.decision,
      why: decisions.why,
      examples: decisions.examples,
    })
    .from(decisions)
    .where(sql`${decisions.embedding} is null`)
    .limit(limit);

  let filled = 0;
  for (const r of rows) {
    const text = [r.title ?? "", r.decision, r.why, (r.examples ?? []).join(" ")].filter(Boolean).join("\n");
    const vec = await tryEmbed(text);
    if (!vec) return { filled, remaining: true };
    await db.update(decisions).set({ embedding: vec }).where(eq(decisions.id, r.id));
    filled++;
  }
  return { filled, remaining: rows.length === limit };
}
