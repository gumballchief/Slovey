import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/config", () => ({
  loadPreflightConfig: () => ({
    config: {
      secretScan: { enabled: false },
      architectureChecks: {
        rules: [
          { type: "forbidden-content", pattern: "forbiddenword", flags: "i", reason: "test rule" },
        ],
        deriveFromDecisions: false,
      },
      decisionChecks: { blockOnHighConfidence: false, minimumBlockingConfidence: 0 },
      maxAttempts: 3,
    },
    source: "default" as const,
  }),
}));

vi.mock("../src/preflight/security", () => ({
  securityReviewCheck: async () => ({
    name: "security-review",
    command: "",
    durationMs: 0,
    status: "pass" as const,
    errors: [],
  }),
}));

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: async () => [],
  runDecisionCheck: async () => ({ violations: [], note: undefined }),
}));

vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: async () => new Map(),
  applyOverrides: (violations: unknown[]) => ({ blocking: violations, warnings: [] }),
}));

vi.mock("../src/preflight/persist", () => ({
  persistRun: async () => "run-id",
}));

import { runRemotePreflight } from "../src/preflight/remote";

describe("R7-138 matched-error fan-out cap", () => {
  it("caps architecture errors and fix instructions", async () => {
    const lines = Array.from({ length: 500 }, () => "forbiddenword");
    const result = await runRemotePreflight("repo-1", {
      files: [{ path: "src/app.ts", content: lines.join("\n") }],
      changedFiles: ["src/app.ts"],
      diff: "change",
    });
    const arch = result.checks.find((c) => c.name === "architecture-check");
    expect(arch).toBeDefined();
    expect(arch?.status).toBe("fail");
    expect(arch?.errors.length).toBeLessThanOrEqual(101);
    expect(result.fixInstructions.length).toBeLessThanOrEqual(150);
  });
});
