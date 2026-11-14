import { architectureCheckContents, rulesFromRejectedDecisions } from "./architecture";
import { loadPreflightConfig } from "./config";
import { fetchRejectedDecisions, runDecisionCheck } from "./decisions";
import { applyOverrides, getActiveOverrides } from "./overrides";
import { toFixInstructions } from "./parse";
import { persistRun } from "./persist";
import { scanForSecrets } from "./redact";
import { securityReviewCheck } from "./security";
import { resolveStatus } from "./engine";
import type { CheckResult, FixInstruction, PreflightResult } from "./types";

export interface RemotePreflightPayload {
  /** Unified diff of the change (drives the decision-graph check). */
  diff?: string;
  /** Paths the change touches (drives path rules + retrieval). */
  changedFiles?: string[];
  /** Full contents of changed files (drives secret-scan + content rules). */
  files?: { path: string; content: string }[];
  branch?: string | null;
  commitSha?: string | null;
  attemptId?: string | null;
}

/**
 * Server-side preflight: runs the checks that don't need a local working tree —
 * decision-graph, architecture rules (config + derived-from-rejected), and the
 * secret scan — against a caller-supplied diff/file payload. Command checks
 * (typecheck/test/build/…) require the local workspace and are reported as
 * skipped with that reason, never silently omitted.
 */
export const REMOTE_PREFLIGHT_MAX_FILES = 200;
export const REMOTE_PREFLIGHT_MAX_FILE_CHARS = 256 * 1024;
export const REMOTE_PREFLIGHT_MAX_TOTAL_CHARS = 3 * 1024 * 1024;
export const REMOTE_PREFLIGHT_MAX_DIFF_CHARS = 1_000_000;
export const REMOTE_PREFLIGHT_MAX_CHANGED_FILES = 5000;
export const REMOTE_PREFLIGHT_MAX_DIFF_FOR_CHECKS = 200_000;

export class RemotePreflightTooLargeError extends Error {
  readonly statusCode = 413;
  readonly code = "PAYLOAD_TOO_LARGE";
  constructor(message: string) {
    super(message);
    this.name = "RemotePreflightTooLargeError";
  }
}

export async function runRemotePreflight(repoId: string, payload: RemotePreflightPayload): Promise<PreflightResult> {
  const started = new Date();
  const files = payload.files ?? [];
  const changedFilesInput = payload.changedFiles ?? [];
  if (files.length > REMOTE_PREFLIGHT_MAX_FILES) {
    throw new RemotePreflightTooLargeError(`Too many files: ${files.length} exceeds limit of ${REMOTE_PREFLIGHT_MAX_FILES}`);
  }
  if (changedFilesInput.length > REMOTE_PREFLIGHT_MAX_CHANGED_FILES) {
    throw new RemotePreflightTooLargeError(`Too many changed files: ${changedFilesInput.length} exceeds limit of ${REMOTE_PREFLIGHT_MAX_CHANGED_FILES}`);
  }
  if (payload.diff !== undefined && payload.diff.length > REMOTE_PREFLIGHT_MAX_DIFF_CHARS) {
    throw new RemotePreflightTooLargeError(`Diff too large: ${payload.diff.length} chars exceeds limit of ${REMOTE_PREFLIGHT_MAX_DIFF_CHARS}`);
  }
  let totalChars = payload.diff?.length ?? 0;
  for (const p of changedFilesInput) {
    totalChars += p.length;
    if (totalChars > REMOTE_PREFLIGHT_MAX_TOTAL_CHARS) {
      throw new RemotePreflightTooLargeError(`Payload too large: exceeds limit of ${REMOTE_PREFLIGHT_MAX_TOTAL_CHARS} chars`);
    }
  }
  for (const f of files) {
    const contentLen = f.content?.length ?? 0;
    if (contentLen > REMOTE_PREFLIGHT_MAX_FILE_CHARS) {
      throw new RemotePreflightTooLargeError(`File too large: ${f.path} exceeds limit of ${REMOTE_PREFLIGHT_MAX_FILE_CHARS} chars`);
    }
    totalChars += contentLen + (f.path?.length ?? 0);
    if (totalChars > REMOTE_PREFLIGHT_MAX_TOTAL_CHARS) {
      throw new RemotePreflightTooLargeError(`Payload too large: exceeds limit of ${REMOTE_PREFLIGHT_MAX_TOTAL_CHARS} chars`);
    }
  }
  const { config } = loadPreflightConfig(process.cwd()); // server defaults; repo config lives client-side
  const changed = [...new Set([...changedFilesInput, ...files.map((f) => f.path)])].slice(0, REMOTE_PREFLIGHT_MAX_CHANGED_FILES);
  const rawDiff = payload.diff ?? files.map((f) => `+++ ${f.path}\n${f.content}`).join("\n");
  const diff = rawDiff.length > REMOTE_PREFLIGHT_MAX_DIFF_FOR_CHECKS ? rawDiff.slice(0, REMOTE_PREFLIGHT_MAX_DIFF_FOR_CHECKS) : rawDiff;

  const checks: CheckResult[] = [];

  // Command checks: honestly skipped — the server has no workspace to run them in.
  for (const name of ["typecheck", "lint", "test", "build"]) {
    checks.push({
      name, status: "skipped", command: "", durationMs: 0, blocking: false, errors: [],
      skippedReason: "Requires the local workspace — run via the MCP tool or CLI on the developer machine.",
    });
  }

  // secret-scan on supplied contents; when contents are unavailable (large,
  // binary, or deleted files omit files[]) fall back to scanning the diff so a
  // secret visible only in the diff cannot bypass the gate. With neither,
  // report skipped instead of omitting the check.
  if (config.secretScan.enabled) {
    const start = Date.now();
    if (files.length) {
      const errors = scanForSecrets(files);
      checks.push({ name: "secret-scan", agent: "security", command: "", durationMs: Date.now() - start, blocking: true, status: errors.length ? "fail" : "pass", errors });
    } else if (diff.trim()) {
      const errors = scanForSecrets([{ path: "diff.patch", content: diff }]);
      checks.push({ name: "secret-scan", agent: "security", command: "", durationMs: Date.now() - start, blocking: true, status: errors.length ? "fail" : "pass", errors });
    } else {
      checks.push({ name: "secret-scan", agent: "security", command: "", durationMs: 0, blocking: true, status: "skipped", errors: [], skippedReason: "No file contents or diff supplied \u2014 secret scan had no coverage." });
    }
  }

  // AI security pass on the supplied diff.
  checks.push({ ...(await securityReviewCheck(diff, changed)), agent: "security", blocking: false });

  // Human overrides apply server-side too.
  const overrides = await getActiveOverrides(repoId, payload.branch ?? null);

  // architecture-check: config rules + rules derived from this repo's rejected decisions.
  const rejected = (await fetchRejectedDecisions(repoId)).filter((d) => !overrides.has(d.id));
  const rules = [
    ...config.architectureChecks.rules,
    ...(config.architectureChecks.deriveFromDecisions ? rulesFromRejectedDecisions(rejected) : []),
  ];
  const arch = architectureCheckContents(files, changed, rules);
  if (!files.length && rules.some((r) => r.type !== "forbidden-path") && arch.status !== "fail") {
    checks.push({ ...arch, blocking: true, status: "skipped", skippedReason: "No file contents supplied \u2014 content rules had no coverage; supply files[] for full enforcement." });
  } else {
    checks.push({ ...arch, blocking: true });
  }

  // decision-check on the supplied diff.
  const startDec = Date.now();
  const decisionResult = await runDecisionCheck(repoId, diff, changed);
  const { blocking: violations, warnings: overrideWarnings } = applyOverrides(decisionResult.violations, overrides);
  const note = decisionResult.note;
  const blockingViolations = violations.filter(
    (v) => !config.decisionChecks.blockOnHighConfidence || v.confidence >= config.decisionChecks.minimumBlockingConfidence,
  );
  checks.push({
    name: "decision-check", command: "", durationMs: Date.now() - startDec, blocking: blockingViolations.length > 0,
    status: blockingViolations.length ? "fail" : "pass", errors: [],
    skippedReason: note && violations.length === 0 ? note : undefined,
  });

  let fixInstructions: FixInstruction[] = [];
  for (const c of checks) if (c.status === "fail" && c.errors.length) fixInstructions.push(...toFixInstructions(c.name, c.errors));
  const seen = new Set<string>();
  fixInstructions = fixInstructions.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  const blocked = checks.some((c) => c.blocking && c.status === "fail") || blockingViolations.length > 0;
  const anyFailure = checks.some((c) => c.status === "fail") || violations.length > 0;
  // Shared resolver — see engine.resolveStatus. The hosted path skips command checks, so
  // `blocked` here always implies a real failure and this stays "fail" as before.
  const status = resolveStatus({ checks, blocked, anyFailure, blockingViolations: blockingViolations.length });

  const result: PreflightResult = {
    status,
    safeToCommit: !blocked,
    safeToPush: !blocked,
    humanReviewRequired: false,
    summary: `${status.toUpperCase()} (remote) — knowledge checks on ${changed.length} changed file(s); command checks require the local workspace.`,
    agentInstruction: blocked
      ? "Agent, do not commit yet. Fix the reported knowledge-check violations, then re-run. Note: typecheck/test/build did NOT run here — run the full gate locally before pushing."
      : "Knowledge checks pass. Run the full local gate (typecheck/test/build) before committing — this remote run cannot execute project commands.",
    mode: "remote",
    attempt: { attemptId: payload.attemptId ?? null, attemptNumber: 1, maxAttempts: config.maxAttempts, remainingAttempts: config.maxAttempts - 1, repeatedFailure: false, unrelatedChangesDetected: false },
    project: { workspacePath: "(remote)", projectType: "unknown", packageManager: "unknown", detectedScripts: [] },
    checks,
    fixInstructions,
    decisionViolations: violations,
    warnings: overrideWarnings,
    nextSteps: ["Run the full local gate before committing."],
    branch: payload.branch ?? null,
    commitSha: payload.commitSha ?? null,
    runId: null,
    createdAt: started.toISOString(),
  };

  try {
    result.runId = await persistRun({ repoId, result, checks, signature: "", changedFiles: changed });
  } catch {
    /* best-effort */
  }
  return result;
}
