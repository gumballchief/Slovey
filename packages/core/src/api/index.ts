// ── The Decision API ──────────────────────────────────────────────────────
// The single, named interface every client consumes (PR review, IDE, MCP, CLI,
// Slack, search, dashboard, agents). The graph is the product; this is its API.

// Reasoned answers / search over the graph (cited, citation-or-silence).
export { reason as ask } from "../reasoning";
export { engineeringSearch as search } from "../reasoning";
// Pre-code constraints for a scope (IDE / agents).
export { contextForScope as whatAppliesHere } from "../reasoning";
export { contextForScope as getConstraints } from "../reasoning";
// Node + edges + versions; neighborhood; version timeline.
export { getDecision } from "../graph";
export { traverse as getRelated } from "../graph";
export { timeline as getHistory } from "../graph";
// Governance / drift.
export { governanceReport } from "../graph";

// Pre-code implementation planning (composes context + canI + rejected).
export { plan } from "../planning";
export type { EngineeringPlan, PlanIntent, PlanStep, RiskLevel } from "../planning";

// Memory health (durability, decay, duplicates, reinforcement state).
export { memoryHealth } from "../memory";
export type { MemoryHealth } from "../memory";

// Net-new verbs.
export { canI } from "./can-i";
export type { CanIResult, RejectedPrecedent } from "./can-i";
export { getRejectedKnowledge } from "./rejected";
export type { RejectedKnowledge } from "./rejected";
export { whatChanged } from "./changes";
export type { DecisionChange } from "./changes";
export { explain } from "./explain";
export type { Explanation } from "./explain";

// Re-export shared answer/citation types for clients.
export type { ReasonedAnswer, Citation, AnswerConfidence } from "../reasoning/types";
export type { EngineeringContext, Constraint } from "../reasoning/context";
