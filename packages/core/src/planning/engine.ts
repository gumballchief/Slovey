import { getAI } from "../ai";
import { canI } from "../api/can-i";
import { getRejectedKnowledge } from "../api/rejected";
import { contextForScope } from "../reasoning/context";
import type { AnswerConfidence } from "../reasoning/types";
import { assessRisk, classifyIntent, extractScope } from "./classify";
import type { EngineeringPlan, PlanStep } from "./types";

/**
 * The Planning Engine — the first interaction an engineer (or coding agent) has
 * with Company Brain, BEFORE code exists. It classifies intent, scopes the
 * request, gathers the decisions/constraints/rejected-precedent that apply, and
 * synthesises an evidence-backed implementation plan.
 *
 * It does NOT bypass the Decision API: every signal comes from CanI, the Context
 * API and rejected knowledge. The LLM is the final step and only writes prose
 * over evidence the graph already supplied — it never invents company facts.
 */
export async function plan(repoId: string, request: string): Promise<EngineeringPlan> {
  const reasoning: string[] = [];
  const { intent, matched } = classifyIntent(request);
  const scope = extractScope(request);
  reasoning.push(`Classified intent=${intent}${matched ? ` (matched "${matched}")` : ""}.`);
  reasoning.push(
    `Extracted scope: ${Object.entries(scope).map(([k, v]) => `${k}=[${(v as string[]).join(", ")}]`).join("; ") || "none"}.`,
  );

  // Gather evidence through the Decision API (parallel; all read-only).
  const hasScope = Object.keys(scope).length > 0;
  const [ctx, verdictRes, rejected] = await Promise.all([
    hasScope ? contextForScope(repoId, scope) : Promise.resolve(null),
    canI(repoId, request),
    getRejectedKnowledge(repoId, request, 5),
  ]);

  const constraints = ctx?.constraints ?? [];
  // Only treat rejected rows as "precedent" when CanI also matched something
  // semantically close, or the row clearly relates — getRejectedKnowledge already
  // ranks by similarity, so the top rows are the relevant ones.
  const rejectedPrecedent = rejected.slice(0, 3);
  reasoning.push(
    `Evidence: ${constraints.length} active constraint(s), CanI verdict=${verdictRes.verdict}, ${rejectedPrecedent.length} rejected precedent(s).`,
  );

  // Conflicts: blockers the engineer must resolve before proceeding.
  const conflicts: string[] = [];
  if (verdictRes.verdict === "disallowed") {
    const c = verdictRes.citations[0];
    conflicts.push(
      `Recorded decisions disallow this: ${verdictRes.rationale}` + (c ? ` (${c.decision})` : ""),
    );
  }
  for (const r of rejectedPrecedent) {
    conflicts.push(
      `Previously rejected: ${r.decision}` +
        (r.rejectionReason ? ` — ${r.rejectionReason}` : "") +
        (r.alternatives.length ? `; instead: ${r.alternatives.join(", ")}` : ""),
    );
  }

  const risk = assessRisk({
    intent,
    verdict: verdictRes.verdict,
    hasRejectedPrecedent: rejectedPrecedent.length > 0,
    constraintCount: constraints.length,
  });

  const hasEvidence =
    constraints.length > 0 || verdictRes.citations.length > 0 || rejectedPrecedent.length > 0;

  // Synthesise the prose plan, grounded strictly in gathered evidence.
  const synth = await synthesisePlan({
    request,
    intent,
    verdict: verdictRes.verdict,
    rationale: verdictRes.rationale,
    constraints: constraints.map((c) => c.decision),
    rejected: rejectedPrecedent.map(
      (r) => `${r.decision}${r.rejectionReason ? ` (rejected: ${r.rejectionReason})` : ""}`,
    ),
  });
  reasoning.push(synth ? "Synthesised plan from evidence." : "LLM unavailable; used deterministic fallback plan.");

  const { summary, steps } = synth ?? fallbackPlan(intent, verdictRes.verdict, hasEvidence);

  // Confidence reflects evidence, never the LLM's self-assessment alone. With no
  // recorded decisions this is a greenfield, advisory plan → low confidence.
  let confidence: AnswerConfidence = hasEvidence ? (synth?.confidence ?? "medium") : "low";
  if (verdictRes.verdict === "disallowed") confidence = "high"; // we're confident about the blocker

  return {
    request,
    intent,
    scope,
    verdict: verdictRes.verdict,
    risk,
    confidence,
    summary,
    steps,
    constraints,
    rejectedPrecedent,
    conflicts,
    citations: verdictRes.citations,
    reasoning,
  };
}

interface SynthInput {
  request: string;
  intent: string;
  verdict: string;
  rationale: string;
  constraints: string[];
  rejected: string[];
}
interface SynthOutput {
  summary: string;
  steps: PlanStep[];
  confidence: AnswerConfidence;
}

async function synthesisePlan(input: SynthInput): Promise<SynthOutput | null> {
  const constraintBlock = input.constraints.length
    ? input.constraints.map((c, i) => `[C${i + 1}] ${c}`).join("\n")
    : "(none recorded)";
  const rejectedBlock = input.rejected.length
    ? input.rejected.map((r, i) => `[R${i + 1}] ${r}`).join("\n")
    : "(none)";

  const prompt = `You are an engineering architect planning work BEFORE any code is written. Produce a concise implementation plan for the request, RESPECTING the team's recorded decisions. Do not invent company-specific facts, services, or decisions beyond those listed. If the request was disallowed or previously rejected, the plan must lead with that and pivot to the allowed alternative.

REQUEST: ${input.request}
INTENT: ${input.intent}
RECORDED VERDICT: ${input.verdict} — ${input.rationale}

ACTIVE CONSTRAINTS (must be honoured):
${constraintBlock}

PREVIOUSLY REJECTED (do not re-propose):
${rejectedBlock}

Respond ONLY with JSON: {"summary":"<2-3 sentence executive summary>","steps":[{"title":"<short>","detail":"<1-2 sentences, reference [C#]/[R#] when relevant>"}],"confidence":"high|medium|low"}. Use 3-6 steps.`;

  const res = await getAI().completeJSON<{
    summary: string;
    steps: Array<{ title: string; detail: string }>;
    confidence: string;
  }>(prompt, { tier: "premium", maxTokens: 700 });

  if (!res?.summary || !Array.isArray(res.steps) || res.steps.length === 0) return null;
  const confidence: AnswerConfidence =
    res.confidence === "high" || res.confidence === "medium" || res.confidence === "low"
      ? res.confidence
      : "medium";
  return {
    summary: res.summary,
    steps: res.steps
      .filter((s) => s?.title && s?.detail)
      .map((s) => ({ title: String(s.title), detail: String(s.detail) })),
    confidence,
  };
}

/** Deterministic plan used when the LLM is unavailable — always a valid shape. */
function fallbackPlan(
  intent: string,
  verdict: string,
  hasEvidence: boolean,
): SynthOutput {
  if (verdict === "disallowed") {
    return {
      summary:
        "This request conflicts with a recorded team decision. Resolve the blocker (see conflicts) or pursue the recorded alternative before proceeding.",
      steps: [
        { title: "Review the blocking decision", detail: "Read the cited decision and confirm it still applies." },
        { title: "Adopt the recorded alternative", detail: "Use the approach the team already settled on instead." },
      ],
      confidence: "high",
    };
  }
  return {
    summary: hasEvidence
      ? `Proceed with this ${intent} work while honouring the listed active constraints.`
      : `No recorded decisions govern this area yet — proceed with standard practice and record a decision once settled.`,
    steps: [
      { title: "Confirm scope and constraints", detail: "Validate the touched services/domains and any active constraints." },
      { title: "Implement incrementally", detail: "Break the change into small, reviewable steps." },
      { title: "Record the decision", detail: "Capture the chosen approach so the brain learns it." },
    ],
    confidence: hasEvidence ? "medium" : "low",
  };
}
