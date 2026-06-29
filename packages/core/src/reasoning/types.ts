import type { DecisionStatus } from "../graph/types";

export interface Citation {
  decisionId: string;
  title: string;
  decision: string;
  status: DecisionStatus;
  evidence: string[];
  freshness: number;
}

export type AnswerConfidence = "high" | "medium" | "low" | "none";

/** Every reasoned answer is explainable: a chain + citations + confidence. */
export interface ReasonedAnswer {
  question: string;
  answer: string;
  confidence: AnswerConfidence;
  citations: Citation[];
  /** The steps the engine took (entities → retrieve → rank → resolve → answer). */
  reasoning: string[];
}
