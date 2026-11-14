import { getDb, decisions, feedback, prChecks } from "@company-brain/db";
import { and, desc, eq } from "drizzle-orm";
import { reinforce } from "../memory";

/** Decision texts this team has dismissed — passed to the judge as negatives. */
export async function getDismissedNotes(repoId: string): Promise<string[]> {
  const db = getDb();
  // Distinct in SQL so LIMIT 20 applies after dedup, not to raw dismiss rows.
  // Fall back to plain select for test doubles that only implement `select`,
  // preserving the repo scoping on both feedback and decisions either way.
  const rows =
    typeof db.selectDistinct === "function"
      ? await db
          .selectDistinct({ decision: decisions.decision })
          .from(feedback)
          .innerJoin(decisions, eq(feedback.decisionId, decisions.id))
          .where(and(eq(feedback.repoId, repoId), eq(feedback.action, "dismiss"), eq(decisions.repoId, repoId)))
          .limit(20)
      : await db
          .select({ decision: decisions.decision })
          .from(feedback)
          .innerJoin(decisions, eq(feedback.decisionId, decisions.id))
          .where(and(eq(feedback.repoId, repoId), eq(feedback.action, "dismiss"), eq(decisions.repoId, repoId)))
          .limit(20);
  return [...new Set(rows.map((r) => r.decision))];
}

export interface RecordFeedbackParams {
  repoId: string;
  prNumber?: number;
  prCheckId?: string;
  decisionId?: string;
  action: "dismiss" | "confirm";
  byUser?: string;
  reason?: string;
}

/**
 * Record dismiss/confirm. If only a PR number is given, link it to that PR's most
 * recent check (and the decision it matched) so the signal attaches to a decision.
 */
export async function recordFeedback(params: RecordFeedbackParams) {
  const db = getDb();
  let prCheckId = params.prCheckId ?? null;
  let decisionId = params.decisionId ?? null;

  if (!prCheckId && params.prNumber != null) {
    const [c] = await db
      .select({ id: prChecks.id, matched: prChecks.matchedDecisionId })
      .from(prChecks)
      .where(and(eq(prChecks.repoId, params.repoId), eq(prChecks.prNumber, params.prNumber)))
      .orderBy(desc(prChecks.checkedAt))
      .limit(1);
    if (c) {
      prCheckId = c.id;
      if (!decisionId) decisionId = c.matched ?? null;
    } else {
      throw new Error("pr check not found for pr number");
    }
  }

  if (decisionId) {
    const [d] = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(and(eq(decisions.id, decisionId), eq(decisions.repoId, params.repoId)))
      .limit(1);
    if (!d) throw new Error("decision does not belong to repo");
  }

  if (prCheckId) {
    const [c2] = await db
      .select({ id: prChecks.id, matched: prChecks.matchedDecisionId })
      .from(prChecks)
      .where(and(eq(prChecks.id, prCheckId), eq(prChecks.repoId, params.repoId)))
      .limit(1);
    if (!c2) throw new Error("pr check does not belong to repo");
    if (!decisionId) decisionId = c2.matched ?? null;
  }

  const [row] = await db
    .insert(feedback)
    .values({
      repoId: params.repoId,
      prCheckId,
      decisionId,
      action: params.action,
      reason: params.reason ?? null,
      byUser: params.byUser ?? null,
    })
    .returning();

  // A human confirmation reinforces the memory: mark it confirmed, refresh
  // freshness, nudge confidence. (Dismissals stay negative — see getDismissedNotes.)
  if (params.action === "confirm" && decisionId) {
    await reinforce(params.repoId, decisionId, "confirmed");
  }
  return row;
}
