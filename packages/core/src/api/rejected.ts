import { decisions, getDb } from "@company-brain/db";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { tryEmbed } from "../embeddings/try";
import { lexicalDistance, lexicalTerms } from "../pipelines/lexical";
import { applyMeaning, pickByMeaning } from "../pipelines/meaning";

export interface RejectedKnowledge {
  id: string;
  decision: string;
  rejectionReason: string | null;
  alternatives: string[];
  evidence: string[];
  createdAt: string;
  /** Cosine distance to the query when semantically searched; null otherwise. */
  distance?: number | null;
}

/**
 * Rejected knowledge — "we already tried this." Lists rejected decisions, or
 * semantically filters them by a query. One of the platform's sharpest edges:
 * no competitor systematically surfaces *negative* engineering history.
 */
export async function getRejectedKnowledge(
  repoId: string,
  query?: string,
  limit = 25,
): Promise<RejectedKnowledge[]> {
  const db = getDb();
  const base = and(eq(decisions.repoId, repoId), eq(decisions.status, "rejected"));

  const rows = query?.trim()
    ? await (async () => {
        const vec = await tryEmbed(query);
        if (!vec) {
          // Embeddings unavailable: rank by keyword overlap instead.
          const q = lexicalTerms(query);
          const all = await db
            .select({ ...getTableColumns(decisions), distance: sql<number>`0::float8` })
            .from(decisions)
            .where(base)
            .orderBy(desc(decisions.createdAt))
            .limit(500);
          // The cheap model adds rejected approaches the query is about by meaning.
          const picks = await pickByMeaning(
            query,
            all.map((r) => ({ id: r.id, text: r.decision })),
            limit,
          );
          return applyMeaning(
            all.map((r) => ({
              ...r,
              distance: lexicalDistance(
                q,
                lexicalTerms([r.decision, r.rejectionReason ?? "", (r.alternatives ?? []).join(" ")].join("\n")),
              ),
            })),
            picks,
          )
            .filter((r) => r.distance < 1)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);
        }
        const lit = `[${vec.join(",")}]`;
        return db
          .select({
            ...getTableColumns(decisions),
            distance: sql<number>`${decisions.embedding} <=> ${lit}::vector`,
          })
          .from(decisions)
          .where(and(base, sql`${decisions.embedding} is not null`))
          .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
          .limit(limit);
      })()
    : await db
        .select({ ...getTableColumns(decisions), distance: sql<number | null>`null::float8` })
        .from(decisions)
        .where(base)
        .orderBy(desc(decisions.createdAt))
        .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    rejectionReason: r.rejectionReason,
    alternatives: r.alternatives ?? [],
    evidence: r.evidence ?? [],
    createdAt: r.createdAt.toISOString(),
    distance: r.distance ?? null,
  }));
}
