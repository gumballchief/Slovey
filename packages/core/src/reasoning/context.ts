import { activeDecisionsForScope, freshnessScore } from "../graph/service";
import type { ScopeQuery } from "../graph/types";

export interface Constraint {
  decisionId: string;
  decision: string;
  why: string;
  importance: string;
  status: string;
  evidence: string[];
  freshness: number;
}

export interface EngineeringContext {
  scope: ScopeQuery;
  constraints: Constraint[];
  /** A compact, paste-into-an-agent system prompt of the active constraints. */
  promptBlock: string;
}

/**
 * The Engineering Context API: given where code is about to be written
 * (paths/services/domains/languages), return the active decisions that govern
 * it — for IDEs and coding agents to consult BEFORE generating code.
 * Deterministic + cited (no LLM): constraints, not prose.
 */
export async function contextForScope(repoId: string, scope: ScopeQuery): Promise<EngineeringContext> {
  const rows = await activeDecisionsForScope(repoId, scope, 30);
  const constraints: Constraint[] = rows
    .map((r) => ({
      decisionId: r.id,
      decision: r.decision,
      why: r.why,
      importance: r.importance,
      status: r.status,
      evidence: r.evidence ?? [],
      freshness: Number(freshnessScore(r).toFixed(2)),
    }))
    .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance) || b.freshness - a.freshness);

  const promptBlock = constraints.length
    ? "Follow these existing team decisions (cite them if relevant):\n" +
      constraints
        .map((c) => `- ${c.decision}${c.evidence.length ? ` [${c.evidence.join(", ")}]` : ""}`)
        .join("\n")
    : "No recorded decisions govern this area yet.";

  return { scope, constraints, promptBlock };
}

function importanceRank(i: string): number {
  return { critical: 3, high: 2, medium: 1, low: 0 }[i] ?? 1;
}
