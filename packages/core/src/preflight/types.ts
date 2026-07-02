/** Preflight — the agent-gating check system. Shared types + the exact
 *  agent-readable result schema. */

export type CheckStatus = "pass" | "fail" | "skipped" | "error";
export type Priority = "critical" | "high" | "medium" | "low";

/** How much of the gate to run. */
export type PreflightMode =
  | "full" // everything configured (default; used by pre-push)
  | "quick" // fast subset: static + typecheck/lint — no test/build/decision-check
  | "commit" // quick + decision-check (used by pre-commit)
  | "push" // alias of full
  | "changed-files" // full, with file-scoped checks limited to the changed set
  | "planning" // pre-code: no commands — return governing decisions + what will be checked
  | "remote"; // server-side: knowledge checks (decision/architecture/secret) on a supplied diff

export type ErrorCategory =
  | "type-error"
  | "lint-error"
  | "test-failure"
  | "build-error"
  | "security"
  | "architecture"
  | "decision"
  | "env"
  | "route"
  | "deps"
  | "format"
  | "runtime"
  | "timeout"
  | "unknown";

/** A structured pointer to why a decision violation applies. */
export interface EvidenceRef {
  type: "adr" | "pr" | "doc" | "comment" | "decision";
  id: string;
  url?: string;
  quote?: string;
}

/** A single parsed error from a check's output. `file` is "" when not scoped to a file. */
export interface PreflightError {
  /** Stable fingerprint of file+code+message — used for repeated-failure detection. */
  id?: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  /** Redacted raw output line(s) this was parsed from, when available. */
  raw?: string;
  category?: ErrorCategory;
  blocking?: boolean;
}

export interface CheckResult {
  name: string;
  status: CheckStatus;
  command: string; // "" for static (non-command) checks
  durationMs: number;
  /** Which supervisor agent owns this check (security/memory/architecture/tooling). */
  agent?: string;
  /** Whether a failure of this check blocks the commit gate (required check). */
  blocking: boolean;
  errors: PreflightError[];
  skippedReason?: string;
  /** Short redacted tails of the captured output (command checks only). */
  stdoutSummary?: string;
  stderrSummary?: string;
}

export interface FixInstruction {
  id: string;
  priority: Priority;
  file: string;
  problem: string;
  /** Written FOR the agent, imperative: "Agent, fix this before continuing." */
  instructionForAgent: string;
  evidence: string;
  checkId?: string;
}

export interface DecisionViolation {
  decisionId: string;
  title: string;
  /** Where the decision sits in the graph (active constraint vs rejected approach). */
  decisionStatus: "active" | "rejected";
  violation: string;
  instructionForAgent: string;
  confidence: number;
  evidence: EvidenceRef[];
}

export interface AttemptInfo {
  /** Client-supplied session id (agents pass the same id across their fix loop). */
  attemptId: string | null;
  attemptNumber: number;
  maxAttempts: number;
  remainingAttempts: number;
  /** Same failure signature as the previous attempt — the fix didn't land. */
  repeatedFailure: boolean;
  /** The changed-file set grew with files unrelated to any reported failure. */
  unrelatedChangesDetected: boolean;
}

export interface ProjectInfoSummary {
  workspacePath: string;
  projectType: "node" | "unknown";
  packageManager: string;
  detectedScripts: string[];
}

/** Pre-code (mode:"planning") payload: what governs this repo before any code is written. */
export interface PlanningContext {
  activeDecisions: { id: string; decision: string; evidence: string[] }[];
  rejectedApproaches: { id: string; decision: string; evidence: string[] }[];
  architectureRules: ArchitectureRule[];
  checksThatWillRun: string[];
}

/** The structured result returned to the AI agent (and persisted). */
export interface PreflightResult {
  /** pass = clean · fail = blocking failures · partial = only optional checks failed · error = engine fault */
  status: "pass" | "fail" | "partial" | "error";
  safeToCommit: boolean;
  safeToPush: boolean;
  humanReviewRequired: boolean;
  summary: string;
  /** Direct message to the agent about what to do next. */
  agentInstruction: string;
  mode: PreflightMode;
  attempt: AttemptInfo;
  project: ProjectInfoSummary;
  checks: CheckResult[];
  fixInstructions: FixInstruction[];
  decisionViolations: DecisionViolation[];
  warnings: string[];
  nextSteps: string[];
  /** Only present for mode:"planning". */
  planning?: PlanningContext;
  branch: string | null;
  commitSha: string | null;
  runId: string | null;
  createdAt: string;
}

// ─────────────────────────── architecture rules ───────────────────────────

export type ArchitectureRule =
  | { type: "forbidden-import"; module: string; in?: string; reason: string }
  | { type: "forbidden-path"; glob: string; reason: string }
  | { type: "forbidden-content"; pattern: string; in?: string; reason: string; flags?: string };

// ─────────────────────────── config ───────────────────────────

export interface PreflightConfig {
  requiredChecks: string[];
  optionalChecks: string[];
  maxAttempts: number;
  blockCommitOnFailure: boolean;
  blockPushOnFailure: boolean;
  allowSkippedChecks: boolean;
  /** Per-check timeout in ms. */
  timeoutMs: number;
  /** Explicit command overrides, e.g. { typecheck: "pnpm typecheck" }. */
  commands: Record<string, string>;
  /** Extra full-command allowlist (merged with detected scripts + safe defaults). */
  allowlistedCommands: string[];
  decisionChecks: {
    enabled: boolean;
    /** Only block the gate on violations at/above this confidence. */
    blockOnHighConfidence: boolean;
    minimumBlockingConfidence: number;
  };
  architectureChecks: {
    enabled: boolean;
    rules: ArchitectureRule[];
    /** Also derive forbidden-pattern rules from REJECTED decisions in the graph (deterministic, no LLM). */
    deriveFromDecisions: boolean;
  };
  secretScan: { enabled: boolean };
}

export const DEFAULT_CONFIG: PreflightConfig = {
  requiredChecks: ["typecheck", "lint", "test", "build", "decision-check", "architecture-check"],
  optionalChecks: ["secret-scan", "security-review", "format", "env-check", "route-check", "deps", "smoke"],
  maxAttempts: 5,
  blockCommitOnFailure: true,
  blockPushOnFailure: true,
  allowSkippedChecks: false,
  timeoutMs: 120_000,
  commands: {},
  allowlistedCommands: [],
  decisionChecks: { enabled: true, blockOnHighConfidence: true, minimumBlockingConfidence: 0.85 },
  architectureChecks: { enabled: true, rules: [], deriveFromDecisions: true },
  secretScan: { enabled: true },
};

/** Checks that run a shell command (detected from package.json or config). */
export const COMMAND_CHECKS = ["typecheck", "lint", "test", "build", "format", "smoke"] as const;
/** Package.json script name candidates per command check, in priority order. */
export const SCRIPT_CANDIDATES: Record<string, string[]> = {
  typecheck: ["typecheck", "type-check", "tsc", "check-types"],
  lint: ["lint", "eslint", "lint:check"],
  test: ["test", "test:unit", "test:ci"],
  build: ["build"],
  format: ["format:check", "format", "prettier:check", "fmt"],
  // Runtime smoke test — boots the app / pings health and exits non-zero on failure.
  smoke: ["smoke", "smoke-test", "test:smoke", "healthcheck", "health-check"],
};

/** Slow checks excluded from quick/commit modes. */
export const SLOW_CHECKS = new Set(["test", "build", "smoke"]);

export interface RunPreflightOptions {
  /** Local repo directory the checks run in. */
  cwd: string;
  /** For decision checks + persistence. Null → those are skipped. */
  repoId?: string | null;
  mode?: PreflightMode;
  /** Agent-supplied loop id, kept stable across fix attempts. */
  attemptId?: string | null;
  requiredChecks?: string[];
  maxAttempts?: number;
  /** Restrict file-scoped checks to these files (defaults to git-detected changes). */
  changedFiles?: string[];
  /** Legacy alias for mode:"commit"-ish behavior: skip the decision-graph check. */
  checkOnly?: boolean;
  /** Persist the run to the DB (needs repoId). Default true when repoId set. */
  persist?: boolean;
  configOverride?: Partial<PreflightConfig>;
}
