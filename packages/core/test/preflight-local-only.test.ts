import { describe, expect, it } from "vitest";
import { localOnlyResult, RemotePreflightHttpError } from "../src/preflight/api-mode";
import type { CheckResult, PreflightResult } from "../src/preflight/types";

function check(name: string, status: CheckResult["status"], blocking = true): CheckResult {
  return { name, status, command: "", durationMs: 1, blocking, errors: [] };
}

function local(checks: CheckResult[]): PreflightResult {
  return {
    status: "pass",
    safeToCommit: true,
    safeToPush: true,
    humanReviewRequired: false,
    summary: "local",
    agentInstruction: "local",
    mode: "full",
    attempt: { attemptId: null, attemptNumber: 0, maxAttempts: 1, remainingAttempts: 1, repeatedFailure: false, unrelatedChangesDetected: false },
    project: { workspacePath: "/tmp", projectType: "node", packageManager: "npm", detectedScripts: [] },
    checks,
    fixInstructions: [],
    decisionViolations: [],
    warnings: [],
    nextSteps: [],
    branch: null,
    commitSha: null,
    runId: null,
    createdAt: new Date(0).toISOString(),
  };
}

const LOCAL = local([check("typecheck", "pass"), check("decision-check", "skipped")]);

describe("localOnlyResult: hosted checks could not be used", () => {
  it("fails open on downtime, with a loud warning", () => {
    for (const err of [new Error("fetch failed"), new RemotePreflightHttpError(503, "hosted preflight HTTP 503"), new RemotePreflightHttpError(429, "hosted preflight HTTP 429")]) {
      const r = localOnlyResult(LOCAL, err);
      expect(r.safeToCommit).toBe(true);
      expect(r.warnings.join(" ")).toMatch(/NOT verified/);
      expect(r.checks.find((c) => c.name === "decision-check")?.blocking).toBe(false);
    }
  });

  it("still blocks on a local failure while the server is down", () => {
    const r = localOnlyResult(local([check("typecheck", "fail"), check("decision-check", "skipped")]), new Error("fetch failed"));
    expect(r.safeToCommit).toBe(false);
    expect(r.status).toBe("fail");
  });

  it("fails closed when the token is rejected, so a bad token can't quietly turn the gate off", () => {
    for (const status of [401, 403]) {
      const r = localOnlyResult(LOCAL, new RemotePreflightHttpError(status, `hosted preflight HTTP ${status}`));
      expect(r.safeToCommit).toBe(false);
      expect(r.safeToPush).toBe(false);
      expect(r.status).toBe("unverified");
      const dc = r.checks.find((c) => c.name === "decision-check");
      expect(dc).toMatchObject({ status: "error", blocking: true });
      expect(r.warnings.join(" ")).toMatch(/rejected your token/);
      expect(r.agentInstruction).toMatch(/do not commit/i);
    }
  });

  it("fails closed on a rejected token even when the local run had no decision-check row", () => {
    const r = localOnlyResult(local([check("typecheck", "pass")]), new RemotePreflightHttpError(401, "x"));
    expect(r.safeToCommit).toBe(false);
    expect(r.checks.some((c) => c.name === "decision-check" && c.blocking)).toBe(true);
  });

  it("leaves the caller's local result untouched", () => {
    const before = JSON.stringify(LOCAL);
    localOnlyResult(LOCAL, new RemotePreflightHttpError(401, "x"));
    localOnlyResult(LOCAL, new Error("down"));
    expect(JSON.stringify(LOCAL)).toBe(before);
  });
});
