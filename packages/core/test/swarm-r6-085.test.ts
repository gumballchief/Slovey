import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: async () => [],
  runDecisionCheck: async () => ({
    violations: [
      {
        decisionId: "d-low",
        title: "low confidence decision",
        decision: "do not use X",
        violation: "uses X",
        confidence: 0.2,
        evidence: [],
      },
    ],
  }),
  distinctiveTerms: () => [],
}));

vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: async () => new Map(),
  applyOverrides: (violations: { decisionId: string }[]) => ({ blocking: violations, warnings: [] }),
}));

vi.mock("../src/preflight/security", () => ({
  securityReviewCheck: async () => ({
    name: "security-review",
    command: "",
    durationMs: 0,
    status: "pass",
    errors: [],
  }),
}));

vi.mock("../src/preflight/config", () => ({
  loadPreflightConfig: () => ({
    config: {
      secretScan: { enabled: false },
      architectureChecks: { rules: [], deriveFromDecisions: false },
      decisionChecks: { blockOnHighConfidence: true, minimumBlockingConfidence: 0.8 },
      maxAttempts: 3,
    },
    source: "default",
  }),
}));

vi.mock("../src/preflight/persist", () => ({
  persistRun: async () => "test-run-id",
}));

import { runRemotePreflight } from "../src/preflight/remote";

describe("R6-085 low-confidence decision should not block remote preflight", () => {
  it("does not block when confidence is below minimumBlockingConfidence", async () => {
    const result = await runRemotePreflight("repo-1", {
      diff: "use X here",
      changedFiles: ["src/a.ts"],
    });
    const decisionCheck = result.checks.find((c) => c.name === "decision-check");
    expect(decisionCheck).toBeDefined();
    expect(decisionCheck?.status).toBe("pass");
    expect(decisionCheck?.blocking).toBe(false);
    expect(result.safeToCommit).toBe(true);
    expect(result.safeToPush).toBe(true);
  });
});
