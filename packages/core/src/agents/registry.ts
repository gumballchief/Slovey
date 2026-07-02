/**
 * The AI-supervisor agent roster. Each specialized agent owns a set of Preflight
 * checks (and, for the Review agent, the post-PR pipeline). The roster is the
 * organizational layer: checks report which agent they belong to, tools can list
 * the roster, and new checks join an agent rather than floating free.
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
    id: "security",
    title: "Security Agent",
    mission: "Stops secrets, injection risks, and unsafe patterns from reaching the repository.",
    checks: ["secret-scan", "security-review"],
    stage: "pre-commit",
  },
  {
    id: "memory",
    title: "Memory Agent",
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
    id: "tooling",
    title: "Tooling Agent",
    mission: "Runs the project's own verification commands and static hygiene checks.",
    checks: ["typecheck", "lint", "test", "build", "format", "smoke", "deps", "env-check", "route-check"],
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

const CHECK_TO_AGENT = new Map<string, SupervisorAgent>();
for (const agent of AGENTS) for (const c of agent.checks) CHECK_TO_AGENT.set(c, agent);

/** Which agent owns a Preflight check ("tooling", "security", …). */
export function agentForCheck(checkName: string): string {
  return CHECK_TO_AGENT.get(checkName)?.id ?? "tooling";
}
