import { getAI } from "../ai";
import { retrieveRanked, toCitation } from "../reasoning/engine";
import type { Citation } from "../reasoning/types";

export interface RejectedPrecedent {
  decision: string;
  rejectionReason: string | null;
  alternatives: string[];
}

export interface CanIResult {
  intent: string;
  verdict: "allowed" | "disallowed" | "unclear";
  rationale: string;
  citations: Citation[];
  /** "We already tried this" — rejected decisions matching the intent. */
  rejectedPrecedent: RejectedPrecedent[];
}

const SILENCE_DISTANCE = 0.6;

/**
 * CanI — the pre-code guardrail. "Can I add Redis?" → allowed/disallowed/unclear,
 * grounded in cited decisions, surfacing rejected precedent. Citation-or-silence:
 * with nothing relevant it returns `unclear` rather than guessing.
 */
export async function canI(repoId: string, intent: string): Promise<CanIResult> {
  const ranked = await retrieveRanked(repoId, intent);
  // Gate on the nearest decision by distance, not ranked[0] (best blended rank) —
  // otherwise a fresher-but-farther decision outranking a closer governing one
  // makes the guardrail wrongly say "nothing recorded" and allow the change.
  const nearestDist = ranked.length ? Math.min(...ranked.map((r) => r.distance)) : Number.POSITIVE_INFINITY;
  if (!ranked.length || nearestDist > SILENCE_DISTANCE) {
    return {
      intent,
      verdict: "unclear",
      rationale: "No recorded engineering decision addresses this — proceed, but consider recording a decision.",
      citations: [],
      rejectedPrecedent: [],
    };
  }

  const considered = ranked.slice(0, 6);
  const rejectedPrecedent: RejectedPrecedent[] = considered
    .filter((r) => r.row.status === "rejected")
    .map((r) => ({
      decision: r.row.decision,
      rejectionReason: r.row.rejectionReason,
      alternatives: r.row.alternatives ?? [],
    }));

  const numbered = considered
    .map((r, i) => {
      const rej =
        r.row.status === "rejected" && r.row.rejectionReason
          ? ` — REJECTED because: ${r.row.rejectionReason}` +
            (r.row.alternatives?.length ? `; instead use: ${r.row.alternatives.join(", ")}` : "")
          : "";
      return `[${i + 1}] (${r.row.status}) ${r.row.decision}${rej}`;
    })
    .join("\n");

  const prompt = `An engineer intends to: "${intent}".

Using ONLY the team decisions below, decide if this is allowed. Rules:
- If a decision forbids it, or it was rejected before, verdict = "disallowed".
- If a decision permits or requires it, verdict = "allowed".
- If the decisions don't determine it, verdict = "unclear" (do NOT guess).
Cite the decisions you used by [number]. Mention "we already tried this" when a rejected decision matches.

DECISIONS:
${numbered}

Respond ONLY with JSON: {"verdict":"allowed|disallowed|unclear","rationale":"<1-2 sentences citing [n]>","used":[<numbers>]}`;

  const res = await getAI().completeJSON<{ verdict: string; rationale: string; used: number[] }>(
    prompt,
    { tier: "premium", maxTokens: 300 },
  );

  const verdict: CanIResult["verdict"] =
    res?.verdict === "allowed" || res?.verdict === "disallowed" || res?.verdict === "unclear"
      ? res.verdict
      : "unclear";
  const usedIdx = (res?.used ?? []).filter((n) => n >= 1 && n <= considered.length);
  const citations: Citation[] = (usedIdx.length ? usedIdx.map((n) => considered[n - 1]!) : []).map(
    toCitation,
  );

  return {
    intent,
    verdict,
    rationale: res?.rationale ?? "Unable to determine from recorded decisions.",
    citations,
    rejectedPrecedent,
  };
}
