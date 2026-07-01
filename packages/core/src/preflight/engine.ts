import { loadPreflightConfig } from "./config";
import { depsCheck, envCheck, routeCheck, runCommandCheck, secretScanCheck } from "./checks";
import { runDecisionCheck } from "./decisions";
import { detectProject, getBranch, getChangedFiles, getCommitSha, getDiff, scriptCommand, type ProjectInfo } from "./detect";
import { toFixInstructions } from "./parse";
import { getLatestAttempt, getLatestRun, persistRun } from "./persist";
import {
  COMMAND_CHECKS,
  SCRIPT_CANDIDATES,
  type CheckResult,
  type DecisionViolation,
  type FixInstruction,
  type PreflightConfig,
  type PreflightResult,
  type RunPreflightOptions,
} from "./types";

// Cheap/static + fast checks first; slow (test/build) then; decision graph last.
const SAFE_ORDER = ["secret-scan", "format", "lint", "typecheck", "env-check", "route-check", "deps", "test", "build", "decision-check"];

/** Run the full preflight gate. Never throws — failures become structured results. */
export async function runPreflight(opts: RunPreflightOptions): Promise<PreflightResult> {
  const { cwd, repoId = null, checkOnly = false } = opts;
  const { config } = loadPreflightConfig(cwd, {
    ...(opts.configOverride ?? {}),
    ...(opts.requiredChecks ? { requiredChecks: opts.requiredChecks } : {}),
    ...(opts.maxAttempts ? { maxAttempts: opts.maxAttempts } : {}),
  });
  const persist = opts.persist ?? Boolean(repoId);

  const project = detectProject(cwd);
  const branch = getBranch(cwd);
  const commitSha = getCommitSha(cwd);
  const changed = getChangedFiles(cwd);

  const wanted = new Set([...config.requiredChecks, ...config.optionalChecks]);
  if (checkOnly) wanted.delete("decision-check");
  const ordered = SAFE_ORDER.filter((c) => wanted.has(c));

  const checks: CheckResult[] = [];
  const decisionViolations: DecisionViolation[] = [];

  for (const name of ordered) {
    if (name === "decision-check") {
      if (!repoId) {
        checks.push(skip(name, "No connected repo (repoId) — decision graph unavailable."));
        continue;
      }
      const start = Date.now();
      const { violations, note } = await runDecisionCheck(repoId, getDiff(cwd, changed), changed);
      decisionViolations.push(...violations);
      checks.push({
        name,
        command: "",
        durationMs: Date.now() - start,
        status: violations.length ? "fail" : "pass",
        errors: [],
        skippedReason: note && violations.length === 0 ? note : undefined,
      });
      continue;
    }
    if ((COMMAND_CHECKS as readonly string[]).includes(name)) {
      const command = resolveCommand(name, config, project);
      if (!command) {
        checks.push(
          skip(name, `No "${name}" command found (config.commands.${name} unset; package.json has none of: ${SCRIPT_CANDIDATES[name]?.join(", ")}).`),
        );
        continue;
      }
      checks.push(await runCommandCheck(name, command, cwd, config.timeoutMs));
      continue;
    }
    if (name === "secret-scan") checks.push(secretScanCheck(cwd, changed));
    else if (name === "env-check") checks.push(envCheck(cwd, changed));
    else if (name === "route-check") checks.push(routeCheck(cwd, changed));
    else if (name === "deps") checks.push(depsCheck(cwd));
  }

  const fixInstructions: FixInstruction[] = [];
  for (const c of checks) {
    if (c.status === "fail" && c.errors.length) fixInstructions.push(...toFixInstructions(c.name, c.errors));
  }
  fixInstructions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const requiredSet = new Set(config.requiredChecks);
  const failingRequired = checks.filter(
    (c) => requiredSet.has(c.name) && (c.status === "fail" || (c.status === "skipped" && !config.allowSkippedChecks)),
  );
  const decisionFail = decisionViolations.length > 0;
  const status: "pass" | "fail" = failingRequired.length > 0 || decisionFail ? "fail" : "pass";

  // ── loop safety ──
  const [priorRun, priorAttempt] = repoId
    ? await Promise.all([getLatestRun(repoId, branch), getLatestAttempt(repoId, branch)])
    : [null, null];
  const signature = buildSignature(fixInstructions, decisionViolations);
  const { attempt, repeated, humanReviewRequired } = evaluateLoop({
    priorRunStatus: priorRun ? priorRun.status : null,
    priorAttempt: priorRun?.attempt ?? 0,
    priorSignature: priorAttempt?.signature ?? null,
    currentStatus: status,
    currentSignature: signature,
    maxAttempts: config.maxAttempts,
  });
  const safeToCommit = status === "pass" ? true : !config.blockCommitOnFailure && !decisionFail;

  const result: PreflightResult = {
    status,
    safeToCommit,
    summary: buildSummary(checks, decisionViolations, status),
    checks,
    fixInstructions,
    decisionViolations,
    attempt,
    maxAttempts: config.maxAttempts,
    humanReviewRequired,
    agentGuidance: buildGuidance({ status, safeToCommit, humanReviewRequired, repeated, fixes: fixInstructions.length, violations: decisionViolations.length }),
    branch,
    commitSha,
    runId: null,
  };

  if (persist && repoId) {
    try {
      result.runId = await persistRun({ repoId, result, checks, signature });
    } catch {
      /* persistence is best-effort — the gate result still stands */
    }
  }
  return result;
}

/**
 * Pure loop-safety math (unit-tested). Attempts count consecutive failing runs
 * on a branch; the counter resets after a pass. Same failure signature across
 * attempts = repeated; hitting maxAttempts while still failing = human review.
 */
export function evaluateLoop(input: {
  priorRunStatus: "pass" | "fail" | null;
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

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function skip(name: string, reason: string): CheckResult {
  return { name, status: "skipped", command: "", durationMs: 0, errors: [], skippedReason: reason };
}

function resolveCommand(name: string, config: PreflightConfig, project: ProjectInfo): string | null {
  if (config.commands[name]) return config.commands[name]!;
  for (const script of SCRIPT_CANDIDATES[name] ?? []) {
    if (project.scripts[script]) return scriptCommand(project.packageManager, script);
  }
  return null;
}

function buildSignature(fixes: FixInstruction[], violations: DecisionViolation[]): string {
  const parts = [
    ...fixes.map((f) => `${f.file}|${f.problem}`),
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

function buildGuidance(x: {
  status: string;
  safeToCommit: boolean;
  humanReviewRequired: boolean;
  repeated: boolean;
  fixes: number;
  violations: number;
}): string {
  if (x.status === "pass") return "All required checks pass. Safe to commit.";
  if (x.humanReviewRequired) {
    return "Human review required. The same failures persist after the maximum number of attempts. Stop, do not commit, and ask a human to look — do not keep guessing at fixes.";
  }
  const parts = ["Agent, fix this before continuing. Do not commit yet."];
  if (x.repeated) parts.push("This still fails — the previous fix did not resolve the issue. Re-read the fix instructions carefully before trying again.");
  if (x.violations) parts.push(`${x.violations} change(s) violate recorded team decisions — see decisionViolations.`);
  if (x.fixes) parts.push(`Address the ${x.fixes} item(s) in fixInstructions, highest priority first.`);
  parts.push("Run Preflight again after fixing.");
  return parts.join(" ");
}
