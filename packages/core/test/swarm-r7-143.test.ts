import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/decisions")>();
  return {
    ...actual,
    fetchRejectedDecisions: vi.fn(async () => [
      { id: "dec-1", decision: "Never use forbiddenwidget in the codebase" },
    ]),
    runDecisionCheck: vi.fn(async () => ({ violations: [] })),
  };
});
vi.mock("../src/preflight/overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/overrides")>();
  return { ...actual, getActiveOverrides: vi.fn(async () => new Map()) };
});
vi.mock("../src/preflight/persist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/persist")>();
  return { ...actual, persistRun: vi.fn(async () => null) };
});
vi.mock("../src/preflight/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/security")>();
  return {
    ...actual,
    securityReviewCheck: vi.fn(async () => ({
      name: "security-review", command: "", durationMs: 0, status: "pass", errors: [],
    })),
  };
});

import { runRemotePreflight } from "../src/preflight/remote";

describe("R7-143 empty-content coverage", () => {
  it("reports secret-scan and architecture-check as skipped, not pass, for an empty file entry", async () => {
    const result = await runRemotePreflight("repo-1", {
      files: [{ path: "src/evil.ts", content: "" }],
      changedFiles: ["src/evil.ts"],
    });
    const secret = result.checks.find((c) => c.name === "secret-scan");
    const arch = result.checks.find((c) => c.name === "architecture-check");
    expect(secret?.status).toBe("skipped");
    expect(arch?.status).toBe("skipped");
  });

  it("reports skipped when changedFiles are not covered by files[] contents", async () => {
    const result = await runRemotePreflight("repo-1", {
      files: [{ path: "src/evil.ts", content: "" }],
      changedFiles: ["src/evil.ts", "src/other.ts"],
    });
    expect(result.checks.find((c) => c.name === "architecture-check")?.status).toBe("skipped");
  });

  it("still catches a secret that appears only in the diff", async () => {
    const secret = `AKIA${"A".repeat(16)}`;
    const result = await runRemotePreflight("repo-1", {
      files: [{ path: "src/evil.ts", content: "" }],
      changedFiles: ["src/evil.ts"],
      diff: `+++ src/evil.ts\n+const k = "${secret}";`,
    });
    const scan = result.checks.find((c) => c.name === "secret-scan");
    expect(scan?.status).toBe("fail");
  });
});
