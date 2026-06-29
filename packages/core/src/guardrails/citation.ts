import {
  CONFIDENCE_ORDER,
  THRESHOLD_TO_MIN_CONFIDENCE,
  type Confidence,
  type ConfidenceThreshold,
} from "@company-brain/config";
import type { JudgeResult } from "../ai/types";

export interface CitableDecision {
  id: string;
  decision: string;
  evidence: string[];
}

/** Normalize a citation token so "PR #29499", "pr 29499", "#29499" all compare equal. */
export function normalizeCitation(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve the judge's `evidence` string back to a real decision in the candidate
 * set. Returns the matched decision, or null if the citation resolves to nothing.
 * This is the hard guardrail: no resolved citation → the comment is never posted.
 */
export function resolveCitation(
  result: Pick<JudgeResult, "evidence">,
  decisions: CitableDecision[],
): CitableDecision | null {
  const target = normalizeCitation(result.evidence ?? "");
  if (!target) return null;
  for (const d of decisions) {
    for (const ev of d.evidence) {
      const n = normalizeCitation(ev);
      if (!n) continue;
      if (n === target || target.includes(n) || n.includes(target)) return d;
    }
  }
  return null;
}

/** True if the model's confidence meets the repo's configured floor. */
export function meetsConfidence(
  confidence: Confidence,
  threshold: ConfidenceThreshold,
): boolean {
  const min = THRESHOLD_TO_MIN_CONFIDENCE[threshold];
  return CONFIDENCE_ORDER.indexOf(confidence) >= CONFIDENCE_ORDER.indexOf(min);
}

export interface GuardDecision {
  /** Whether a comment may be posted. */
  post: boolean;
  matched: CitableDecision | null;
  reason: string;
}

/**
 * The single authority on whether a warning may be posted. Enforces, in order:
 * (1) the model wants to warn, (2) confidence floor, (3) a resolvable citation,
 * (4) `strict` additionally requires the citation to resolve (already implied).
 */
export function guardWarning(
  result: JudgeResult,
  decisions: CitableDecision[],
  threshold: ConfidenceThreshold,
): GuardDecision {
  if (!result.warn) return { post: false, matched: null, reason: "no-conflict" };
  if (!meetsConfidence(result.confidence, threshold)) {
    return { post: false, matched: null, reason: "below-confidence-floor" };
  }
  const matched = resolveCitation(result, decisions);
  if (!matched) {
    return { post: false, matched: null, reason: "no-resolvable-citation" };
  }
  return { post: true, matched, reason: "ok" };
}
