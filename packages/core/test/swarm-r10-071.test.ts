import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", () => {
  return {
    fetchRejectedDecisions: async () => [],
    runDecisionCheck: async () => ({ violations: [], note: undefined }),
  };
});

vi.mock("../src/preflight/overrides", () => {
  return {
    getActiveOverrides: async () => new Map(),
    applyOverrides: (violations: unknown[]) => ({ blocking: violations, warnings: [] }),
  };
});

vi.mock("../src/preflight/security", () => {
  return {
    securityReviewCheck: async () => ({
      name: "security-review",
      command: "",
      durationMs: 0,
      status: "pass" as const,
      errors: [],
    }),
  };
});

vi.mock("../src/preflight/persist", () => {
  return {
    persistRun: async () => "run-id",
  };
});

import { runRemotePreflight } from "../src/preflight/remote";

describe("R10-071: decision-check with no content coverage", () => {
  it("reports skipped (not pass) for changedFiles with no diff and no files", async () => {
    const result = await runRemotePreflight("repo-1", { changedFiles: ["src/auth.ts"] });
    const decision = result.checks.find((c) => c.name === "decision-check");
    expect(decision).toBeDefined();
    expect(decision?.status).toBe("skipped");
    expect(decision?.blocking).toBe(true);
    expect(decision?.skippedReason).toMatch(/no coverage/i);
  });
});
