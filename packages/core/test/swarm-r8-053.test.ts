import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: async () => [],
  runDecisionCheck: async () => ({ violations: [] }),
  distinctiveTerms: () => [],
}));
vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: async () => new Map(),
  applyOverrides: (violations: unknown[]) => ({ blocking: violations, warnings: [] as string[] }),
}));
vi.mock("../src/preflight/persist", () => ({
  persistRun: async () => "run-1",
}));
vi.mock("../src/preflight/security", () => ({
  securityReviewCheck: async () => ({
    name: "security-review",
    status: "pass" as const,
    command: "",
    durationMs: 0,
    errors: [],
  }),
}));

import { runRemotePreflight } from "../src/preflight/remote";

describe("remote preflight secret scan coverage", () => {
  it("detects a secret placed after the first 200k chars of the diff", async () => {
    const benign = "const benign = 1;\n".repeat(12_000); // >200k chars
    const secret = "AKIA1234567890ABCDEF";
    const diff = `${benign}+const awsKey = \"${secret}\";\n`;
    expect(diff.length).toBeGreaterThan(200_000);
    expect(diff.indexOf(secret)).toBeGreaterThan(200_000);
    const result = await runRemotePreflight("repo-1", { diff, changedFiles: ["src/app.ts"] });
    const scan = result.checks.find((c) => c.name === "secret-scan");
    expect(scan?.status).toBe("fail");
    expect(scan?.errors.length).toBeGreaterThan(0);
    expect(result.safeToCommit).toBe(false);
  });
});
