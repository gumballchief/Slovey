import { decisions as decisionsTable, getDb } from "@company-brain/db";
import { and, eq, inArray } from "drizzle-orm";
import { agentForCheck } from "../agents/registry";
import { architectureCheck, rulesFromRejectedDecisions } from "./architecture";
import { loadPreflightConfig } from "./config";
import { depsCheck, envCheck, routeCheck, runCommandCheck, secretScanCheck, type RawCheck } from "./checks";
import { fetchRejectedDecisions, runDecisionCheck } from "./decisions";
import { detectProject, getBranch, getChangedFiles, getCommitSha, getDiff, scriptCommand, type ProjectInfo } from "./detect";
import { fingerprint, toFixInstructions } from "./parse";
import { getLatestAttempt, getLatestRun, persistRun } from "./persist";
import { perfCheck } from "./performance";
import { securityReviewCheck } from "./security";
import {
  COMMAND_CHECKS,
  SCRIPT_CANDIDATES,
  SLOW_CHECKS,
  type AttemptInfo,
  type CheckResult,
  type DecisionViolation,
  type FixInstruction,
  type PlanningContext,
  type PreflightConfig,
  type PreflightMode,
  type PreflightResult,
  type RunPreflightOptions,
} from "./types";

// Cheap/static + fast checks first; slow (test/build/smoke/perf) then; AI passes last.
const SAFE_ORDER = [
  "secret-scan", "architecture-check", "perf-check", "format", "lint", "typecheck",
  "env-check", "route-check", "deps", "test", "build", "smoke", "perf",
  "security-review", "decision-check",
];

/** Run the full preflight gate. Never throws — failures become structured results. */
export async function runPreflight(opts: RunPreflightOptions): Promise<PreflightResult> {
  try {
    return await runPreflightInner(opts);
  } catch (e) {
    // Engine fault (not a check failure) — status:"error", never safe to commit.
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: "error",
      safeToCommit: false,
      safeToPush: false,
      humanReviewRequired: false,
      summary: `Preflight itself failed: ${message}`,
      agentInstruction: `Preflight could not complete (${message}). Do not commit. Fix the environment or configuration, then run Preflight again.`,
      mode: opts.mode ?? "full",
      attempt: { attemptId: opts.attemptId ?? null, attemptNumber: 0, maxAttempts: 0, remainingAttempts: 0, repeatedFailure: false, unrelatedChangesDetected: false },
      project: { workspacePath: opts.cwd, projectType: "unknown", packageManager: "unknown", detectedScripts: [] },
      checks: [],
      fixInstructions: [],
      decisionViolations: [],
      warnings: [],
      nextSteps: ["Fix the reported engine error, then run preflight_run again."],
      branch: null,
      commitSha: null,
      runId: null,
      createdAt: new Date().toISOString(),
    };
  }
}

async function runPreflightInner(opts: RunPreflightOptions): Promise<PreflightResult> {
  const { cwd, repoId = null, checkOnly = false } = opts;
  const mode: PreflightMode = opts.mode ?? "full";
  const { config, warning: configWarning } = loadPreflightConfig(cwd, {
    ...(opts.configOverride ?? {}),
    ...(opts.requiredChecks ? { requiredChecks: opts.requiredChecks } : {}),
    ...(opts.maxAttempts ? { maxAttempts: opts.maxAttempts } : {}),
  });
  const persist = opts.persist ?? Boolean(repoId);
  const warnings: string[] = configWarning ? [configWarning] : [];

  const project = detectProject(cwd);
  const branch = getBranch(cwd);
  const commitSha = getCommitSha(cwd);
  const changed = opts.changedFiles && opts.changedFiles.length > 0 ? opts.changedFiles : getChangedFiles(cwd);
  const projectSummary = {
    workspacePath: cwd,
    projectType: project.type,
    packageManager: project.packageManager,
    detectedScripts: Object.keys(SCRIPT_CANDIDATES).filter((c) =>
      SCRIPT_CANDIDATES[c]!.some((s) => project.scripts[s]),
    ),
  };

  // ── pre-code mode: no commands, just what governs this repo ──
  if (mode === "planning") {
    const planning = await buildPlanningContext(repoId, config);
    return {
      status: "pass",
      safeToCommit: false,
      safeToPush: false,
      humanReviewRequired: false,
      summary: `Planning context: ${planning.activeDecisions.length} active decision(s), ${planning.rejectedApproaches.length} rejected approach(es), ${planning.architectureRules.length} architecture rule(s).`,
      agentInstruction:
        "Before writing code: respect the active decisions, do NOT reintroduce any rejected approach, and follow the architecture rules below. " +
        `After coding, run preflight_run (these checks will run: ${planning.checksThatWillRun.join(", ")}).`,
      mode,
      attempt: { attemptId: opts.attemptId ?? null, attemptNumber: 0, maxAttempts: config.maxAttempts, remainingAttempts: config.maxAttempts, repeatedFailure: false, unrelatedChangesDetected: false },
      project: projectSummary,
      checks: [],
      fixInstructions: [],
      decisionViolations: [],
      warnings,
      nextSteps: ["Write the code.", "Call preflight_run before committing."],
      planning,
      branch,
      commitSha,
      runId: null,
      createdAt: new Date().toISOString(),
    };
  }

  // ── select checks for this mode ──
  const wanted = new Set([...config.requiredChecks, ...config.optionalChecks]);
  if (checkOnly) wanted.delete("decision-check");
  if (!config.decisionChecks.enabled) wanted.delete("decision-check");
  if (!config.architectureChecks.enabled) wanted.delete("architecture-check");
  if (!config.secretScan.enabled) wanted.delete("secret-scan");
  if (mode === "quick" || mode === "commit") {
    for (const slow of SLOW_CHECKS) wanted.delete(slow);
    if (mode === "quick") {
      wanted.delete("decision-check");
      wanted.delete("security-review"); // AI passes belong to commit/full, not the seconds-fast gate
    }
  }
  const ordered = SAFE_ORDER.filter((c) => wanted.has(c));
  const requiredSet = new Set(config.requiredChecks);
  const stamp = (c: RawCheck): CheckResult => ({ ...c, agent: agentForCheck(c.name), blocking: requiredSet.has(c.name) });

  // Architecture rules = config rules + rules derived from this repo's REJECTED
  // decisions (deterministic guard that works even when the AI judge is down).
  let archRules = config.architectureChecks.rules;
  if (repoId && config.architectureChecks.deriveFromDecisions && wanted.has("architecture-check")) {
    archRules = [...archRules, ...rulesFromRejectedDecisions(await fetchRejectedDecisions(repoId))];
  }

  const checks: CheckResult[] = [];
  const decisionViolations: DecisionViolation[] = [];

  for (const name of ordered) {
    if (name === "decision-check") {
      if (!repoId) {
        checks.push(stamp({ name, status: "skipped", command: "", durationMs: 0, errors: [], skippedReason: "No connected repo (repoId) — decision graph unavailable." }));
        continue;
      }
      const start = Date.now();
      const { violations, note } = await runDecisionCheck(repoId, getDiff(cwd, changed), changed);
      decisionViolations.push(...violations);
      checks.push(stamp({
        name,
        command: "",
        durationMs: Date.now() - start,
        status: violations.length ? "fail" : "pass",
        errors: [],
        skippedReason: note && violations.length === 0 ? note : undefined,
      }));
      continue;
    }
    if (name === "architecture-check") {
      checks.push(stamp(architectureCheck(cwd, changed, archRules)));
      continue;
    }
    if (name === "security-review") {
      checks.push(stamp(await securityReviewCheck(getDiff(cwd, changed), changed)));
      continue;
    }
    if (name === "perf-check") {
      checks.push(stamp(perfCheck(cwd, changed)));
      continue;
    }
    if ((COMMAND_CHECKS as readonly string[]).includes(name)) {
      const command = resolveCommand(name, config, project);
      if (!command) {
        checks.push(stamp({
          name, status: "skipped", command: "", durationMs: 0, errors: [],
          skippedReason: `No "${name}" command found (config.commands.${name} unset; package.json has none of: ${SCRIPT_CANDIDATES[name]?.join(", ")}).`,
        }));
        continue;
      }
      checks.push(stamp(await runCommandCheck(name, command, cwd, config.timeoutMs, config.allowlistedCommands)));
      continue;
    }
    if (name === "secret-scan") checks.push(stamp(secretScanCheck(cwd, changed)));
    else if (name === "env-check") checks.push(stamp(envCheck(cwd, changed)));
    else if (name === "route-check") checks.push(stamp(routeCheck(cwd, changed)));
    else if (name === "deps") checks.push(stamp(depsCheck(cwd)));
  }

  let fixInstructions: FixInstruction[] = [];
  for (const c of checks) {
    if (c.status === "fail" && c.errors.length) fixInstructions.push(...toFixInstructions(c.name, c.errors));
  }
  fixInstructions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  // Same fingerprint (e.g. one secret pattern hit on several lines of a file) → one instruction.
  const seenFix = new Set<string>();
  fixInstructions = fixInstructions.filter((f) => (seenFix.has(f.id) ? false : (seenFix.add(f.id), true)));

  // ── gate ──
  const failingRequired = checks.filter(
    (c) => c.blocking && (c.status === "fail" || (c.status === "skipped" && !config.allowSkippedChecks)),
  );
  const blockingViolations = decisionViolations.filter(
    (v) => !config.decisionChecks.blockOnHighConfidence || v.confidence >= config.decisionChecks.minimumBlockingConfidence,
  );
  if (decisionViolations.length > blockingViolations.length) {
    warnings.push(
      `${decisionViolations.length - blockingViolations.length} decision violation(s) below the blocking confidence threshold (${config.decisionChecks.minimumBlockingConfidence}) — review them, but they do not block.`,
    );
  }
  const anyFailure = checks.some((c) => c.status === "fail") || decisionViolations.length > 0;
  const blocked = failingRequired.length > 0 || blockingViolations.length > 0;
  const status: PreflightResult["status"] = blocked ? "fail" : anyFailure ? "partial" : "pass";

  // ── loop safety ──
  const [priorRun, priorAttempt] = repoId
    ? await Promise.all([getLatestRun(repoId, branch), getLatestAttempt(repoId, branch)])
    : [null, null];
  const signature = buildSignature(fixInstructions, decisionViolations);
  const loop = evaluateLoop({
    priorRunStatus: priorRun ? (priorRun.status as "pass" | "fail") : null,
    priorAttempt: priorRun?.attempt ?? 0,
    priorSignature: priorAttempt?.signature ?? null,
    currentStatus: blocked ? "fail" : "pass",
    currentSignature: signature,
    maxAttempts: config.maxAttempts,
  });
  const priorChanged = Array.isArray(priorAttempt?.changedFiles) ? (priorAttempt.changedFiles as string[]) : [];
  const unrelatedChangesDetected =
    blocked && detectUnrelatedChanges(priorChanged, changed, fixInstructions.map((f) => f.file));
  const regression = detectRegression(priorAttempt?.signature ?? null, signature);
  if (regression) warnings.push("Fix regression: the previous failures were resolved, but this attempt introduced NEW failures.");
  if (unrelatedChangesDetected) warnings.push("You changed unrelated files. Focus only on the listed failures.");

  const attempt: AttemptInfo = {
    attemptId: opts.attemptId ?? null,
    attemptNumber: loop.attempt,
    maxAttempts: config.maxAttempts,
    remainingAttempts: Math.max(0, config.maxAttempts - loop.attempt),
    repeatedFailure: loop.repeated,
    unrelatedChangesDetected,
  };

  const safeToCommit = !blocked ? true : !config.blockCommitOnFailure && blockingViolations.length === 0;
  const safeToPush = !blocked ? true : !config.blockPushOnFailure && blockingViolations.length === 0;

  const result: PreflightResult = {
    status,
    safeToCommit,
    safeToPush,
    humanReviewRequired: loop.humanReviewRequired,
    summary: buildSummary(checks, decisionViolations, status),
    agentInstruction: buildInstruction({
      status, safeToCommit, humanReviewRequired: loop.humanReviewRequired,
      repeated: loop.repeated, unrelated: unrelatedChangesDetected, regression,
      fixes: fixInstructions.length, violations: blockingViolations.length,
    }),
    mode,
    attempt,
    project: projectSummary,
    checks,
    fixInstructions,
    decisionViolations,
    warnings,
    nextSteps: buildNextSteps({ status, safeToCommit, humanReviewRequired: loop.humanReviewRequired }),
    branch,
    commitSha,
    runId: null,
    createdAt: new Date().toISOString(),
  };

  if (persist && repoId) {
    try {
      result.runId = await persistRun({ repoId, result, checks, signature, changedFiles: changed });
    } catch {
      /* persistence is best-effort — the gate result still stands */
    }
  }
  return result;
}

/** Pre-code context: the decisions + rules that govern this repo. */
async function buildPlanningContext(repoId: string | null, config: PreflightConfig): Promise<PlanningContext> {
  const checksThatWillRun = [...new Set([...config.requiredChecks, ...config.optionalChecks])];
  if (!repoId) {
    return { activeDecisions: [], rejectedApproaches: [], architectureRules: config.architectureChecks.rules, checksThatWillRun };
  }
  const db = getDb();
  const rows = await db
    .select({ id: decisionsTable.id, decision: decisionsTable.decision, evidence: decisionsTable.evidence, status: decisionsTable.status })
    .from(decisionsTable)
    .where(and(eq(decisionsTable.repoId, repoId), inArray(decisionsTable.status, ["approved", "proposed", "rejected"])))
    .limit(120)
    .catch(() => [] as { id: string; decision: string; evidence: string[] | null; status: string }[]);
  const rejected = rows.filter((r) => r.status === "rejected");
  return {
    activeDecisions: rows.filter((r) => r.status !== "rejected").map((r) => ({ id: r.id, decision: r.decision, evidence: r.evidence ?? [] })),
    rejectedApproaches: rejected.map((r) => ({ id: r.id, decision: r.decision, evidence: r.evidence ?? [] })),
    architectureRules: [
      ...config.architectureChecks.rules,
      ...(config.architectureChecks.deriveFromDecisions ? rulesFromRejectedDecisions(rejected) : []),
    ],
    checksThatWillRun,
  };
}

/**
 * Pure loop-safety math (unit-tested). Attempts count consecutive failing runs
 * on a branch; the counter resets after a pass. Same failure signature across
 * attempts = repeated; hitting maxAttempts while still failing = human review.
 */
export function evaluateLoop(input: {
  priorRunStatus: "pass" | "fail" | "partial" | "error" | null;
  priorAttempt: number;
  priorSignature: string | null;
  currentStatus: "pass" | "fail";
  currentSignature: string;
  maxAttempts: number;
}): { attempt: number; repeated: boolean; humanReviewRequired: boolean } {
  const base = input.priorRunStatus === "fail" ? input.priorAttempt : 0;
  const attempt = base + 1;
  const repeated =
    input.currentStatus === "fail" && input.priorRunStatus === "fail" && input.priorSignature === input.currentSignature;
  const humanReviewRequired = input.currentStatus === "fail" && attempt >= input.maxAttempts;
  return { attempt, repeated, humanReviewRequired };
}

/** New changed files that no reported failure mentions → the agent is drifting. */
export function detectUnrelatedChanges(priorChanged: string[], currentChanged: string[], failureFiles: string[]): boolean {
  if (priorChanged.length === 0) return false;
  const prior = new Set(priorChanged);
  const referenced = new Set(failureFiles.filter(Boolean));
  const newUnreferenced = currentChanged.filter((f) => !prior.has(f) && !referenced.has(f));
  return newUnreferenced.length > 0;
}

/** Previous failures all resolved but new ones appeared → a fix regression. */
export function detectRegression(priorSignature: string | null, currentSignature: string): boolean {
  if (!priorSignature || !currentSignature) return false;
  const prior = new Set(priorSignature.split("\n").filter(Boolean));
  const current = new Set(currentSignature.split("\n").filter(Boolean));
  if (prior.size === 0 || current.size === 0) return false;
  const overlap = [...current].some((s) => prior.has(s));
  return !overlap;
}

/** Describe every configured check for this repo: what would run, with what command, owned by which agent. */
export function listChecks(cwd: string): {
  name: string;
  agent: string;
  kind: "command" | "static" | "decision-graph" | "ai-review";
  required: boolean;
  command: string | null;
  available: boolean;
  note?: string;
}[] {
  const { config } = loadPreflightConfig(cwd);
  const project = detectProject(cwd);
  const requiredSet = new Set(config.requiredChecks);
  const wanted = [...new Set([...config.requiredChecks, ...config.optionalChecks])];
  return SAFE_ORDER.filter((c) => wanted.includes(c)).map((name) => {
    const agent = agentForCheck(name);
    if ((COMMAND_CHECKS as readonly string[]).includes(name)) {
      const command = resolveCommand(name, config, project);
      return {
        name, agent, kind: "command" as const, required: requiredSet.has(name), command,
        available: !!command,
        note: command ? undefined : `No script/command configured (candidates: ${SCRIPT_CANDIDATES[name]?.join(", ")}).`,
      };
    }
    if (name === "decision-check") {
      return {
        name, agent, kind: "decision-graph" as const, required: requiredSet.has(name), command: null,
        available: config.decisionChecks.enabled,
        note: config.decisionChecks.enabled ? "Checks the diff against the Decision Graph." : "Disabled in config.",
      };
    }
    if (name === "security-review") {
      return {
        name, agent, kind: "ai-review" as const, required: requiredSet.has(name), command: null,
        available: true,
        note: "AI security pass on the diff (injection, authz, unsafe patterns). Skips gracefully if AI is unavailable.",
      };
    }
    const available =
      name === "architecture-check"
        ? config.architectureChecks.enabled
        : name === "secret-scan"
          ? config.secretScan.enabled
          : true;
    return { name, agent, kind: "static" as const, required: requiredSet.has(name), command: null, available };
  });
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function resolveCommand(name: string, config: PreflightConfig, project: ProjectInfo): string | null {
  if (config.commands[name]) return config.commands[name]!;
  for (const script of SCRIPT_CANDIDATES[name] ?? []) {
    if (project.scripts[script]) return scriptCommand(project.packageManager, script);
  }
  return null;
}

function buildSignature(fixes: FixInstruction[], violations: DecisionViolation[]): string {
  const parts = [
    ...fixes.map((f) => f.id ?? fingerprint({ file: f.file, message: f.problem })),
    ...violations.map((v) => `decision:${v.decisionId}`),
  ].sort();
  return parts.join("\n").slice(0, 4000);
}

function buildSummary(checks: CheckResult[], violations: DecisionViolation[], status: string): string {
  const pass = checks.filter((c) => c.status === "pass").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const skipped = checks.filter((c) => c.status === "skipped").length;
  return `${status.toUpperCase()} — ${pass} passed, ${fail} failed, ${skipped} skipped` +
    (violations.length ? `, ${violations.length} decision violation(s)` : "") + ".";
}

function buildInstruction(x: {
  status: string;
  safeToCommit: boolean;
  humanReviewRequired: boolean;
  repeated: boolean;
  unrelated: boolean;
  regression: boolean;
  fixes: number;
  violations: number;
}): string {
  if (x.status === "pass") return "All required checks pass. Safe to commit.";
  if (x.status === "partial") {
    return "All BLOCKING checks pass — safe to commit. Some optional checks failed; consider addressing fixInstructions before finishing.";
  }
  if (x.humanReviewRequired) {
    return "Stop. Human review is required. The same blocking issue remains after the maximum number of attempts — do not commit, and do not keep guessing at fixes.";
  }
  const parts = ["Agent, do not commit yet. Fix these issues first."];
  if (x.repeated) parts.push("This is still failing — the previous attempt did not resolve the issue. Re-read the fix instructions carefully before trying again.");
  if (x.regression) parts.push("Your last fix introduced NEW failures while resolving the old ones — review your recent changes.");
  if (x.unrelated) parts.push("You changed unrelated files. Focus only on the listed failures.");
  if (x.violations) parts.push(`${x.violations} change(s) violate recorded team decisions — see decisionViolations.`);
  if (x.fixes) parts.push(`Address the ${x.fixes} item(s) in fixInstructions, highest priority first.`);
  parts.push("Run preflight_run again after applying fixes.");
  return parts.join(" ");
}

function buildNextSteps(x: { status: string; safeToCommit: boolean; humanReviewRequired: boolean }): string[] {
  if (x.humanReviewRequired) return ["Stop and ask a human to review the remaining failures."];
  if (x.safeToCommit) return ["Commit your changes.", "Run preflight_run with mode:\"push\" before pushing."];
  return ["Apply every fixInstructions item.", "Run preflight_run again.", "Only commit once safeToCommit is true."];
}
