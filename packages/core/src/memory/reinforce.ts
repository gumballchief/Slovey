import { decisions, getDb } from "@company-brain/db";
import { and, eq, sql } from "drizzle-orm";
import type { DecisionRow } from "../graph/types";

/** A signal that a memory is still valid: human-confirmed, or used in an answer. */
export type ReinforcementKind = "confirmed" | "referenced";

const CONFIRM_BUMP = 0.1;
const REFERENCE_BUMP = 0.03;
const MAX_CONFIDENCE = 0.99;

/**
 * Reinforcement — knowledge strengthens through use. A human confirmation marks
 * the memory `confirmed`, refreshes its recency (freshness) and nudges
 * confidence up; a citation in an answer gives a smaller nudge without
 * resetting recency. Confidence is clamped so it can never reach a fake 1.0.
 * Bounded + idempotent-ish: repeated signals asymptote rather than runaway.
 */
export async function reinforce(
  repoId: string,
  decisionId: string,
  kind: ReinforcementKind,
): Promise<DecisionRow | null> {
  const db = getDb();
  const set: Record<string, unknown> = {};
  if (kind === "confirmed") {
    set.review = "confirmed";
    set.updatedAt = new Date(); // re-validation refreshes freshness
    set.confidence = sql`least(${MAX_CONFIDENCE}, ${decisions.confidence} + ${CONFIRM_BUMP})`;
  } else {
    // A reference is weak evidence of continued relevance: nudge confidence only,
    // never reset recency (reads must not inflate freshness).
    set.confidence = sql`least(${MAX_CONFIDENCE}, ${decisions.confidence} + ${REFERENCE_BUMP})`;
  }
  const [row] = await db
    .update(decisions)
    .set(set)
    .where(and(eq(decisions.id, decisionId), eq(decisions.repoId, repoId)))
    .returning();
  return row ?? null;
}
