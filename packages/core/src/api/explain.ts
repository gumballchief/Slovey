import { getDecision } from "../graph";
import type { DecisionRow, EdgeRow } from "../graph/types";

export interface Explanation {
  decision: DecisionRow;
  summary: string;
  relationships: Array<{ type: string; targets: string[] }>;
}

/** Explain — a decision's structured lineage (status, evidence, relationships). Deterministic. */
export async function explain(repoId: string, id: string): Promise<Explanation | null> {
  const node = await getDecision(repoId, id);
  if (!node) return null;
  const { decision, outgoing } = node;

  const byType = new Map<string, string[]>();
  const ref = (e: EdgeRow) =>
    e.toDecisionId ?? `${e.toEntityType ?? "entity"}:${e.toEntityRef ?? "?"}`;
  for (const e of outgoing) {
    byType.set(e.type, [...(byType.get(e.type) ?? []), ref(e)]);
  }
  const relationships = [...byType].map(([type, targets]) => ({ type, targets }));

  const summary =
    `${decision.title ?? decision.decision} — status=${decision.status}, importance=${decision.importance}` +
    (decision.evidence?.length ? `, evidence: ${decision.evidence.join(", ")}` : "") +
    (relationships.length
      ? `. Relationships: ${relationships.map((r) => `${r.type}→${r.targets.length}`).join(", ")}`
      : "");

  return { decision, summary, relationships };
}
