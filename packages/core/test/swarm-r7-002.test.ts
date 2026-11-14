import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: async () => [],
  runDecisionCheck: async () => ({ violations: [] }),
}));

vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: async () => new Map(),
  applyOverrides: (v: unknown[]) => ({ blocking: v, warnings: [] }),
}));

vi.mock("../src/preflight/persist", () => ({
  persistRun: async () => "mock-run-id",
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

import { runRemotePreflight } from "../src/preflight/remote";

describe("R7-002 partial files[] must not bypass diff secret scan", () => {
  it("fails secret-scan when the secret is only in diff", async () => {
    const result = await runRemotePreflight("repo-id", {
      files: [{ path: "a.ts", content: "export const x = 1;\n" }],
      diff: "diff --git a/b.ts b/b.ts\n+ const key = \"AKIAIOSFODNN7EXAMPLE\";\n",
      changedFiles: ["a.ts", "b.ts"],
    });
    const scan = result.checks.find((c) => c.name === "secret-scan");
    expect(scan?.status).toBe("fail");
    expect(scan?.errors.length).toBeGreaterThan(0);
  });
});
