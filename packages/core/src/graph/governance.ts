import { decisions, getDb } from "@company-brain/db";
import { eq } from "drizzle-orm";
import { freshnessScore } from "./service";
import { ACTIVE_STATUSES, isActiveStatus } from "./types";
import { listConflictEdges } from "./service";

export interface GovernanceReport {
  totalActive: number;
  counts: Record<string, number>;
  /** Active decisions whose confidence has decayed — likely need re-confirmation. */
  stale: Array<{ id: string; decision: string; freshness: number; updatedAt: string }>;
  /** Active decisions with no supporting evidence — provenance gaps. */
  orphaned: Array<{ id: string; decision: string }>;
  /** Active decisions awaiting human review (candidates surfaced for confirmation). */
  needsReview: Array<{ id: string; decision: string; confidence: number }>;
  /** Pairs explicitly marked contradicting/conflicting in the graph. */
  conflicts: Array<{ fromDecisionId: string; toDecisionId: string | null; type: string }>;
}

const STALE_FRESHNESS = 0.3;

/**
 * Continuous governance: surface decision drift — stale, orphaned (no evidence),
 * unreviewed, and conflicting decisions — so the graph stays trustworthy.
 */
export async function governanceReport(repoId: string): Promise<GovernanceReport> {
  const db = getDb();
  const rows = await db.select().from(decisions).where(eq(decisions.repoId, repoId));

  const counts: Record<string, number> = {};
  const stale: GovernanceReport["stale"] = [];
  const orphaned: GovernanceReport["orphaned"] = [];
  const needsReview: GovernanceReport["needsReview"] = [];

  for (const r of rows) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (!isActiveStatus(r.status)) continue;
    const f = freshnessScore(r);
    if (f < STALE_FRESHNESS) {
      stale.push({ id: r.id, decision: r.decision, freshness: Number(f.toFixed(2)), updatedAt: r.updatedAt.toISOString() });
    }
    if ((r.evidence ?? []).length === 0) orphaned.push({ id: r.id, decision: r.decision });
    if (r.review === "unreviewed" && r.confidence < 0.75) {
      needsReview.push({ id: r.id, decision: r.decision, confidence: Number(r.confidence.toFixed(2)) });
    }
  }

  const conflictEdges = await listConflictEdges(repoId);
  return {
    totalActive: rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    counts,
    stale: stale.sort((a, b) => a.freshness - b.freshness).slice(0, 50),
    orphaned: orphaned.slice(0, 50),
    needsReview: needsReview.sort((a, b) => a.confidence - b.confidence).slice(0, 50),
    conflicts: conflictEdges.map((e) => ({
      fromDecisionId: e.fromDecisionId,
      toDecisionId: e.toDecisionId,
      type: e.type,
    })),
  };
}
