import { describe, expect, it } from "vitest";
import { mergeRemote } from "../src/preflight/api-mode";
import type { CheckResult, PreflightResult } from "../src/preflight/types";

function makeResult(checks: CheckResult[], extra?: Partial<PreflightResult>): PreflightResult {
  return {
    status: "pass",
    safeToCommit: true,
    safeToPush: true,
    humanReviewRequired: false,
    summary: "base",
    agentInstruction: "base",
    mode: "full",
    attempt: {
      attemptId: null,
      attemptNumber: 0,
      maxAttempts: 3,
      remainingAttempts: 3,
      repeatedFailure: false,
      unrelatedChangesDetected: false,
    },
    project: { workspacePath: "/tmp/repo", projectType: "node", packageManager: "npm", detectedScripts: [] },
    checks,
    fixInstructions: [],
    decisionViolations: [],
    warnings: [],
    nextSteps: [],
    branch: null,
    commitSha: null,
    runId: null,
    createdAt: new Date(0).toISOString(),
    ...extra,
  };
}

describe("R10-050: unverified merged gate must not be safe", () => {
  it("blocking skipped required check is not safe to commit/push", () => {
    const local = makeResult([
      {
        name: "typecheck",
        status: "skipped",
        command: "npm run typecheck",
        durationMs: 1,
        blocking: true,
        errors: [],
        skippedReason: 'No "typecheck" script exists; skipping.',
      },
      { name: "secret-scan", status: "pass", command: "", durationMs: 1, blocking: true, errors: [] },
    ]);
    const remote = makeResult([
      { name: "decision-check", status: "pass", command: "", durationMs: 1, blocking: true, errors: [] },
      { name: "security-review", status: "pass", command: "", durationMs: 1, blocking: true, errors: [] },
    ]);
    const merged = mergeRemote(local, remote);
    expect(merged.status).not.toBe("pass");
    expect(merged.safeToCommit).toBe(false);
    expect(merged.safeToPush).toBe(false);
  });
});
