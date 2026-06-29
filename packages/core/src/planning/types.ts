import type { Citation, AnswerConfidence } from "../reasoning/types";
import type { Constraint } from "../reasoning/context";
import type { ScopeQuery } from "../graph/types";
import type { CanIResult } from "../api/can-i";
import type { RejectedKnowledge } from "../api/rejected";

/** Engineering intent of a request — drives the reasoning strategy. */
export type PlanIntent =
  | "feature"
  | "refactor"
  | "migration"
  | "infrastructure"
  | "performance"
  | "security"
  | "database"
  | "api"
  | "testing"
  | "documentation"
  | "bugfix"
  | "research"
  | "unknown";

export type RiskLevel = "low" | "medium" | "high";

export interface PlanStep {
  title: string;
  detail: string;
}

/**
 * The output of the Planning Engine: an evidence-backed implementation plan.
 * Verdict, risk, constraints, rejected precedent and citations are computed
 * deterministically from the graph; only the prose plan (summary + steps) is
 * synthesised by the LLM, grounded strictly in that evidence.
 */
export interface EngineeringPlan {
  request: string;
  intent: PlanIntent;
  scope: ScopeQuery;
  /** Whether recorded decisions allow this work (from CanI). */
  verdict: CanIResult["verdict"];
  risk: RiskLevel;
  confidence: AnswerConfidence;
  summary: string;
  steps: PlanStep[];
  /** Active decisions that govern the touched scope. */
  constraints: Constraint[];
  /** "We already tried this" — rejected approaches matching the request. */
  rejectedPrecedent: RejectedKnowledge[];
  /** Human-readable conflict notes (blockers the engineer must resolve first). */
  conflicts: string[];
  citations: Citation[];
  /** Step-by-step trace of how the plan was assembled. */
  reasoning: string[];
}
