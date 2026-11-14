import { describe, it, expect, vi } from "vitest";

vi.mock("../src/preflight/config", () => ({
  loadPreflightConfig: () => ({
    config: {
      secretScan: { enabled: true },
      architectureChecks: { rules: [], deriveFromDecisions: false },
      decisionChecks: { blockOnHighConfidence: false, minimumBlockingConfidence: 0.8 },
      maxAttempts: 3,
    },
  }),
}));
vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: vi.fn(async () => []),
  runDecisionCheck: vi.fn(async () => ({ violations: [] })),
}));
vi.mock("../src/preflight/overrides", () => ({
  getActiveOverrides: vi.fn(async () => new Map()),
  applyOverrides: (v: unknown[]) => ({ blocking: v, warnings: [] }),
}));
vi.mock("../src/preflight/security", () => ({
  securityReviewCheck: vi.fn(async () => ({ name: "security-review", status: "pass", command: "", durationMs: 0, errors: [] })),
}));
vi.mock("../src/preflight/persist", () => ({
  persistRun: vi.fn(async () => "run-id"),
}));

import { runRemotePreflight } from "../src/preflight/remote";

describe("R3-144 secret-scan blocks remote preflight", () => {
  it("leaked AWS key is blocking and not safeToCommit", async () => {
    const result = await runRemotePreflight("repo-1", {
      changedFiles: ["src/app.ts"],
      files: [{ path: "src/app.ts", content: "const key = 'AKIAIOSFODNN7EXAMPLE';\n" }],
    });
    const secret = result.checks.find((c) => c.name === "secret-scan");
    expect(secret?.status).toBe("fail");
    expect(secret?.blocking).toBe(true);
    expect(result.safeToCommit).toBe(false);
    expect(result.safeToPush).toBe(false);
  });
});
