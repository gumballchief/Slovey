import { decisions, getDb } from "@company-brain/db";
import { and, desc, eq, gt, or } from "drizzle-orm";

export interface DecisionChange {
  id: string;
  decision: string;
  status: string;
  version: number;
  updatedAt: string;
  isNew: boolean;
}

/**
 * WhatChanged — decisions created or updated since a timestamp. Powers
 * "what changed since last year?" and change digests for the org.
 */
export async function whatChanged(
  repoId: string,
  since: Date,
  limit = 100,
): Promise<DecisionChange[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(decisions)
    .where(
      and(eq(decisions.repoId, repoId), or(gt(decisions.updatedAt, since), gt(decisions.createdAt, since))),
    )
    .orderBy(desc(decisions.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    status: r.status,
    version: r.version,
    updatedAt: r.updatedAt.toISOString(),
    isNew: r.createdAt.getTime() >= since.getTime(),
  }));
}
