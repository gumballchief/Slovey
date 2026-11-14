import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/config", () => ({
  loadPreflightConfig: () => ({
    config: {
      maxAttempts: 3,
      decisionChecks: { blockOnHighConfidence: false, minimumBlockingConfidence: 0 },
      architectureChecks: { enabled: true, deriveFromDecisions: false, rules: [] },
      secretScan: { enabled: true },
    },
    source: "default" as const,
  }),
}));

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: vi.fn(async () => []),
  runDecisionCheck: vi.fn(async () => ({ violations: [], note: "mock" })),
}));

vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: vi.fn(async () => new Map()),
  applyOverrides: (v: unknown[]) => ({ blocking: v, warnings: [] }),
}));

vi.mock("../src/preflight/persist", () => ({
  persistRun: vi.fn(async () => "run-id"),
}));

vi.mock("../src/preflight/security", () => ({
  securityReviewCheck: vi.fn(async () => ({
    name: "security-review",
    command: "",
    durationMs: 0,
    status: "pass",
    errors: [],
  })),
}));

import { runRemotePreflight } from "../src/preflight/remote";

describe("R6-089 diff-only payload must not bypass secret-scan", () => {
  it("fails secret-scan when the secret is only in the diff", async () => {
    const leaked = `ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789aBcD`;
    const result = await runRemotePreflight("repo-id", {
      diff: `diff --git a/src/app.ts b/src/app.ts\n+const token = "${leaked}";\n`,
      changedFiles: ["src/app.ts"],
      files: [],
    });
    const secretCheck = result.checks.find((c) => c.name === "secret-scan");
    expect(secretCheck).toBeDefined();
    expect(secretCheck!.status).toBe("fail");
    expect(result.safeToCommit).toBe(false);
  });
});
