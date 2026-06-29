import { decisions, getDb } from "@company-brain/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { getEmbeddings } from "../embeddings";

export interface RejectedKnowledge {
  id: string;
  decision: string;
  rejectionReason: string | null;
  alternatives: string[];
  evidence: string[];
  createdAt: string;
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
        const vec = await getEmbeddings().embedOne(query);
        const lit = `[${vec.join(",")}]`;
        return db
          .select()
          .from(decisions)
          .where(and(base, sql`${decisions.embedding} is not null`))
          .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
          .limit(limit);
      })()
    : await db.select().from(decisions).where(base).orderBy(desc(decisions.createdAt)).limit(limit);

  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    rejectionReason: r.rejectionReason,
    alternatives: r.alternatives ?? [],
    evidence: r.evidence ?? [],
    createdAt: r.createdAt.toISOString(),
  }));
}
