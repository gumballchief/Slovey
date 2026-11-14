import { describe, expect, it } from "vitest";
import { mergeRemote } from "../src/preflight/api-mode";
import type { CheckResult, PreflightResult } from "../src/preflight/types";

function check(name: string, status: CheckResult["status"]): CheckResult {
  return { name, status, command: "", durationMs: 1, blocking: true, errors: [] };
}

function base(over: Partial<PreflightResult> & { status: PreflightResult["status"] }): PreflightResult {
  return {
    safeToCommit: true,
    safeToPush: true,
    humanReviewRequired: false,
    summary: "base",
    agentInstruction: "base",
    mode: "full",
    attempt: { attemptId: null, attemptNumber: 0, maxAttempts: 1, remainingAttempts: 1, repeatedFailure: false, unrelatedChangesDetected: false },
    project: { workspacePath: "/tmp", projectType: "node", packageManager: "npm", detectedScripts: [] },
    checks: [],
    fixInstructions: [],
    decisionViolations: [],
    warnings: [],
    nextSteps: [],
    branch: null,
    commitSha: null,
    runId: null,
    createdAt: new Date(0).toISOString(),
    ...over,
  };
}

describe("R11-084 remote error/unverified handling", () => {
  it("a hosted error fails open like downtime, but never silently", () => {
    const local = base({ status: "pass", checks: [check("typecheck", "pass")] });
    const remote = base({ status: "error", checks: [] });
    const merged = mergeRemote(local, remote);
    expect(merged.safeToCommit).toBe(true);
    expect(merged.warnings.join(" ")).toMatch(/NOT verified/);
  });

  it("a remote decision-check that could not run keeps the merge unverified", () => {
    const local = base({ status: "pass", checks: [check("typecheck", "pass")] });
    const remote = base({ status: "unverified", checks: [check("decision-check", "skipped")] });
    const merged = mergeRemote(local, remote);
    expect(merged.status).toBe("unverified");
    expect(merged.safeToCommit).toBe(false);
  });

  it("folds remote architecture-check with status error and no errors", () => {
    const local = base({ status: "pass", checks: [check("typecheck", "pass"), check("architecture-check", "pass")] });
    const remote = base({
      status: "error",
      checks: [{ name: "architecture-check", status: "error", command: "", durationMs: 1, blocking: true, errors: [] }],
    });
    const merged = mergeRemote(local, remote);
    const arch = merged.checks.find((c) => c.name === "architecture-check");
    expect(arch?.status).not.toBe("pass");
    expect(merged.safeToCommit).toBe(false);
  });
});
