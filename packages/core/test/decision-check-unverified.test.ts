import { describe, expect, it, vi } from "vitest";

// When the AI provider or decision store is down (e.g. Gemini credits run out),
// the hosted check must fail OPEN but say "NOT VERIFIED", never "safe".
const decisionCheck = vi.fn();
vi.mock("../src/preflight/decisions", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/decisions")>();
  return {
    ...orig,
    fetchRejectedDecisions: vi.fn(async () => []),
    runDecisionCheck: (...args: unknown[]) => decisionCheck(...args),
  };
});
vi.mock("../src/preflight/overrides", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/overrides")>();
  return { ...orig, getActiveOverrides: vi.fn(async () => new Map()) };
});
vi.mock("../src/preflight/security", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/security")>();
  return {
    ...orig,
    securityReviewCheck: vi.fn(async () => ({ name: "security-review", command: "", durationMs: 0, blocking: false, status: "pass", errors: [] })),
  };
});
vi.mock("../src/preflight/persist", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/persist")>();
  return { ...orig, persistRun: vi.fn(async () => "test-run-id") };
});

import { runRemotePreflight } from "../src/preflight/remote";

const diff = `--- a/apps/mcp/package.json\n+++ b/apps/mcp/package.json\n@@ -1 +1 @@\n-    "test": "vitest run",\n+    "test": "jest",`;

describe("decision check that could not run", () => {
  it("fails open but is reported as NOT VERIFIED, with a warning", async () => {
    decisionCheck.mockResolvedValueOnce({ violations: [], note: "Decision store unavailable — decision check unverified.", unverified: true });
    const r = await runRemotePreflight("repo-id", { diff, changedFiles: ["apps/mcp/package.json"] });
    expect(r.safeToCommit).toBe(true);
    const dc = r.checks.find((c) => c.name === "decision-check")!;
    expect(dc.status).toBe("skipped");
    expect(dc.blocking).toBe(false);
    expect(r.summary).toMatch(/^NOT VERIFIED/);
    expect(r.agentInstruction).toMatch(/NOT verified/);
    expect(r.warnings.join(" ")).toMatch(/NOT verified/);
  });

  it("still blocks a real violation found in keyword-only mode", async () => {
    decisionCheck.mockResolvedValueOnce({
      violations: [{ decisionId: "d1", title: "Use Vitest", decisionStatus: "rejected", violation: "adds jest", confidence: 0.95, evidence: [], instructionForAgent: "x" }],
      note: "Decision check ran in keyword-only mode (AI unavailable).",
      unverified: true,
    });
    const r = await runRemotePreflight("repo-id", { diff, changedFiles: ["apps/mcp/package.json"] });
    expect(r.safeToCommit).toBe(false);
    expect(r.checks.find((c) => c.name === "decision-check")!.status).toBe("fail");
  });

  it("a healthy clean check still reads as a pass", async () => {
    decisionCheck.mockResolvedValueOnce({ violations: [] });
    const r = await runRemotePreflight("repo-id", { diff, changedFiles: ["apps/mcp/package.json"] });
    expect(r.safeToCommit).toBe(true);
    expect(r.summary).toMatch(/^PASS/);
    expect(r.warnings.join(" ")).not.toMatch(/NOT verified/);
  });
});
