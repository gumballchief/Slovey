import type { decisionEdges, decisions } from "@company-brain/db";

/** A decision as stored — the canonical graph node. */
export type DecisionRow = typeof decisions.$inferSelect;
export type DecisionStatus = DecisionRow["status"];
export type DecisionImportance = DecisionRow["importance"];
export type DecisionReview = DecisionRow["review"];
export type EdgeRow = typeof decisionEdges.$inferSelect;
export type EdgeType = EdgeRow["type"];
export type EntityType = NonNullable<EdgeRow["toEntityType"]>;

/** Lifecycle states in which a decision still governs new work. */
export const ACTIVE_STATUSES: DecisionStatus[] = ["approved", "proposed"];
/** A decision the team explicitly turned away from — negative knowledge. */
export const REJECTED_STATUSES: DecisionStatus[] = ["rejected"];
/** No longer governs (history), but still queryable. */
export const RETIRED_STATUSES: DecisionStatus[] = [
  "deprecated",
  "superseded",
  "archived",
  "removed",
];

export function isActiveStatus(s: DecisionStatus): boolean {
  return ACTIVE_STATUSES.includes(s);
}

/** Input to create a decision in the graph. Most fields optional with defaults. */
export interface CreateDecisionInput {
  decision: string;
  title?: string;
  summary?: string;
  why?: string;
  examples?: string[];
  evidence: string[];
  source: DecisionRow["source"];
  category?: string | null;
  status?: DecisionStatus;
  ownerUser?: string | null;
  owningTeam?: string | null;
  importance?: DecisionImportance;
  priority?: number;
  confidence?: number;
  domains?: string[];
  services?: string[];
  affectedRepos?: string[];
  directories?: string[];
  languages?: string[];
  frameworks?: string[];
  rejectionReason?: string | null;
  alternatives?: string[];
  createdBy?: string;
}

/** A target of a graph edge: another decision, or an external entity. */
export type EdgeTarget =
  | { decisionId: string }
  | { entityType: EntityType; entityRef: string };

/** Scope filter for "which decisions apply here?" (Context API, check). */
export interface ScopeQuery {
  paths?: string[];
  directories?: string[];
  services?: string[];
  domains?: string[];
  languages?: string[];
  frameworks?: string[];
}
