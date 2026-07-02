/**
 * The AI-supervisor agent roster. Each specialized agent owns a set of Preflight
 * checks (and, for the Review agent, the post-PR pipeline). The pipeline:
 *
 *   Claude writes code
 *             │
 *             ▼
 *      Company Brain
 *             │
 *    ┌────────┼────────┐
 *    │        │        │
 *    ▼        ▼        ▼
 *  Build   Security  Decision
 *  Agent     Agent     Agent
 *    │        │        │
 *    └────────┼────────┘
 *             ▼
 *     Architecture Agent
 *             │
 *             ▼
 *     Performance Agent
 *             │
 *             ▼
 *       Testing Agent
 *             │
 *             ▼
 *       Context Agent
 *             │
 *             ▼
 *       Final Verdict  (safeToCommit + agentInstruction)
 *
 * Execution interleaves cheap checks first for latency; results are PRESENTED
 * in pipeline order, and the Final Verdict aggregates every agent's findings.
 */

export interface SupervisorAgent {
  id: string;
  title: string;
  /** What this agent is responsible for, in one sentence. */
  mission: string;
  /** Preflight check names this agent owns. */
  checks: string[];
  /** Where it runs. */
  stage: "pre-code" | "pre-commit" | "post-pr";
}

export const AGENTS: SupervisorAgent[] = [
  {
    id: "build",
    title: "Build Agent",
    mission: "The code must compile, lint, and resolve: typecheck, lint, build, formatting, dependency integrity.",
    checks: ["typecheck", "lint", "build", "format", "deps"],
    stage: "pre-commit",
  },
  {
    id: "security",
    title: "Security Agent",
    mission: "Stops secrets, injection, missing authorization, and unsafe patterns from reaching the repository.",
    checks: ["secret-scan", "security-review"],
    stage: "pre-commit",
  },
  {
    id: "decision",
    title: "Decision Agent",
    mission: "Enforces the Engineering Decision Graph — active constraints and rejected approaches.",
    checks: ["decision-check"],
    stage: "pre-commit",
  },
  {
    id: "architecture",
    title: "Architecture Agent",
    mission: "Enforces structural rules: forbidden imports/paths/patterns, config-defined and derived from rejected decisions.",
    checks: ["architecture-check"],
    stage: "pre-commit",
  },
  {
    id: "performance",
    title: "Performance Agent",
    mission: "Catches known performance footguns: blocking sync calls in request handlers, unawaited parallelism, wasteful patterns.",
    checks: ["perf-check", "perf"],
    stage: "pre-commit",
  },
  {
    id: "testing",
    title: "Testing Agent",
    mission: "Runs the test suite and runtime smoke checks.",
    checks: ["test", "smoke"],
    stage: "pre-commit",
  },
  {
    id: "context",
    title: "Context Agent",
    mission: "Validates the change against repository context — route contracts, env-var contract — and serves the pre-code planning context.",
    checks: ["env-check", "route-check"],
    stage: "pre-commit",
  },
  {
    id: "review",
    title: "Review Agent",
    mission: "Reviews every pull request against team memory and posts cited verdicts (checkPr).",
    checks: [],
    stage: "post-pr",
  },
];

/** Presentation order of the pipeline (Final Verdict aggregates all of them). */
export const AGENT_PIPELINE = ["build", "security", "decision", "architecture", "performance", "testing", "context"] as const;

const CHECK_TO_AGENT = new Map<string, SupervisorAgent>();
for (const agent of AGENTS) for (const c of agent.checks) CHECK_TO_AGENT.set(c, agent);

/** Which agent owns a Preflight check ("build", "security", …). */
export function agentForCheck(checkName: string): string {
  return CHECK_TO_AGENT.get(checkName)?.id ?? "build";
}

/** Sort index for presenting checks in pipeline order. */
export function agentPipelineIndex(agentId: string): number {
  const i = (AGENT_PIPELINE as readonly string[]).indexOf(agentId);
  return i === -1 ? AGENT_PIPELINE.length : i;
}
