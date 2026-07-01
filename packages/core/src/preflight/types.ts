/** Preflight — the agent-gating check system. Shared types + the exact
 *  agent-readable result schema. */

export type CheckStatus = "pass" | "fail" | "skipped";
export type Priority = "critical" | "high" | "medium" | "low";

/** A single parsed error from a check's output. `file` is "" when not scoped to a file. */
export interface PreflightError {
  file: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
}

export interface CheckResult {
  name: string;
  status: CheckStatus;
  command: string; // "" for static (non-command) checks
  durationMs: number;
  errors: PreflightError[];
  skippedReason?: string;
}

export interface FixInstruction {
  priority: Priority;
  file: string;
  problem: string;
  /** Written FOR the agent, imperative: "Agent, fix this before continuing." */
  instructionForAgent: string;
  evidence: string;
}

export interface DecisionViolation {
  decisionId: string;
  title: string;
  violation: string;
  instructionForAgent: string;
  confidence: number;
  evidence: string[];
}

/** The structured result returned to the AI agent (and persisted). */
export interface PreflightResult {
  status: "pass" | "fail";
  safeToCommit: boolean;
  summary: string;
  checks: CheckResult[];
  fixInstructions: FixInstruction[];
  decisionViolations: DecisionViolation[];

  // ── loop safety + meta (extends the base schema) ──
  attempt: number;
  maxAttempts: number;
  humanReviewRequired: boolean;
  /** Direct message to the agent about what to do next. */
  agentGuidance: string;
  branch: string | null;
  commitSha: string | null;
  runId: string | null;
}

export interface PreflightConfig {
  requiredChecks: string[];
  optionalChecks: string[];
  maxAttempts: number;
  blockCommitOnFailure: boolean;
  allowSkippedChecks: boolean;
  /** Per-check timeout in ms. */
  timeoutMs: number;
  /** Explicit command overrides, e.g. { typecheck: "pnpm typecheck" }. */
  commands: Record<string, string>;
}

export const DEFAULT_CONFIG: PreflightConfig = {
  requiredChecks: ["typecheck", "lint", "test", "build", "decision-check"],
  optionalChecks: ["secret-scan", "format", "env-check", "route-check", "deps"],
  maxAttempts: 5,
  blockCommitOnFailure: true,
  allowSkippedChecks: false,
  timeoutMs: 120_000,
  commands: {},
};

/** Checks that run a shell command (detected from package.json or config). */
export const COMMAND_CHECKS = ["typecheck", "lint", "test", "build", "format"] as const;
/** Package.json script name candidates per command check, in priority order. */
export const SCRIPT_CANDIDATES: Record<string, string[]> = {
  typecheck: ["typecheck", "type-check", "tsc", "check-types"],
  lint: ["lint", "eslint", "lint:check"],
  test: ["test", "test:unit", "test:ci"],
  build: ["build"],
  format: ["format:check", "format", "prettier:check", "fmt"],
};

export interface RunPreflightOptions {
  /** Local repo directory the checks run in. */
  cwd: string;
  /** For decision checks + persistence. Null → those are skipped. */
  repoId?: string | null;
  requiredChecks?: string[];
  maxAttempts?: number;
  /** Skip the decision-graph check (static + command checks only). */
  checkOnly?: boolean;
  /** Persist the run to the DB (needs repoId). Default true when repoId set. */
  persist?: boolean;
  configOverride?: Partial<PreflightConfig>;
}
