import { architectureCheckContents, rulesFromRejectedDecisions } from "./architecture";
import { loadPreflightConfig } from "./config";
import { fetchRejectedDecisions, runDecisionCheck } from "./decisions";
import { toFixInstructions } from "./parse";
import { persistRun } from "./persist";
import { scanForSecrets } from "./redact";
import { securityReviewCheck } from "./security";
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
export async function runRemotePreflight(repoId: string, payload: RemotePreflightPayload): Promise<PreflightResult> {
  const started = new Date();
  const { config } = loadPreflightConfig(process.cwd()); // server defaults; repo config lives client-side
  const files = payload.files ?? [];
  const changed = [...new Set([...(payload.changedFiles ?? []), ...files.map((f) => f.path)])];
  const diff = payload.diff ?? files.map((f) => `+++ ${f.path}\n${f.content}`).join("\n");

  const checks: CheckResult[] = [];

  // Command checks: honestly skipped — the server has no workspace to run them in.
  for (const name of ["typecheck", "lint", "test", "build"]) {
    checks.push({
      name, status: "skipped", command: "", durationMs: 0, blocking: false, errors: [],
      skippedReason: "Requires the local workspace — run via the MCP tool or CLI on the developer machine.",
    });
  }

  // secret-scan on supplied contents.
  if (config.secretScan.enabled && files.length) {
    const start = Date.now();
    const errors = scanForSecrets(files);
    checks.push({ name: "secret-scan", agent: "security", command: "", durationMs: Date.now() - start, blocking: false, status: errors.length ? "fail" : "pass", errors });
  }

  // AI security pass on the supplied diff.
  checks.push({ ...(await securityReviewCheck(diff, changed)), agent: "security", blocking: false });

  // architecture-check: config rules + rules derived from this repo's rejected decisions.
  const rejected = await fetchRejectedDecisions(repoId);
  const rules = [
    ...config.architectureChecks.rules,
    ...(config.architectureChecks.deriveFromDecisions ? rulesFromRejectedDecisions(rejected) : []),
  ];
  const arch = architectureCheckContents(files, changed, rules);
  checks.push({ ...arch, blocking: true });

  // decision-check on the supplied diff.
  const startDec = Date.now();
  const { violations, note } = await runDecisionCheck(repoId, diff, changed);
  checks.push({
    name: "decision-check", command: "", durationMs: Date.now() - startDec, blocking: true,
    status: violations.length ? "fail" : "pass", errors: [],
    skippedReason: note && violations.length === 0 ? note : undefined,
  });

  let fixInstructions: FixInstruction[] = [];
  for (const c of checks) if (c.status === "fail" && c.errors.length) fixInstructions.push(...toFixInstructions(c.name, c.errors));
  const seen = new Set<string>();
  fixInstructions = fixInstructions.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  const blockingViolations = violations.filter(
    (v) => !config.decisionChecks.blockOnHighConfidence || v.confidence >= config.decisionChecks.minimumBlockingConfidence,
  );
  const blocked = checks.some((c) => c.blocking && c.status === "fail") || blockingViolations.length > 0;
  const anyFailure = checks.some((c) => c.status === "fail") || violations.length > 0;
  const status: PreflightResult["status"] = blocked ? "fail" : anyFailure ? "partial" : "pass";

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
    warnings: [],
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
