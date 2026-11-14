import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/decisions")>();
  return { ...actual, fetchRejectedDecisions: async () => [], runDecisionCheck: async () => ({ violations: [] }) };
});

vi.mock("../src/preflight/overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/overrides")>();
  return { ...actual, getActiveOverrides: async () => new Map() };
});

vi.mock("../src/preflight/persist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/persist")>();
  return { ...actual, persistRun: async () => "test-run-id" };
});

vi.mock("../src/preflight/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/security")>();
  return { ...actual, securityReviewCheck: async () => ({ name: "security-review", command: "", durationMs: 0, status: "pass" as const, errors: [] }) };
});

describe("R8-052 secret scan beyond truncation", () => {
  it("fails secret-scan for a secret placed after 200k in a large diff", async () => {
    const { runRemotePreflight } = await import("../src/preflight/remote");
    const padding = "a\n".repeat(105_000);
    const secret = "AKIA1234567890ABCDEF";
    const diff = `${padding}+${secret}\n`;
    if (diff.length <= 200_000) throw new Error("test setup: diff must exceed truncation cap");
    const result = await runRemotePreflight("repo-r8-052", { diff, changedFiles: ["src/app.ts"], files: [] });
    const scan = result.checks.find((c) => c.name === "secret-scan");
    expect(scan).toBeDefined();
    expect(scan!.status).toBe("fail");
    expect(scan!.errors.length).toBeGreaterThan(0);
  });
});
