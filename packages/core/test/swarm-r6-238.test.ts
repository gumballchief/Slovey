import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/config", () => ({
  CONFIG_FILENAME: "companybrain.preflight.json",
  loadPreflightConfig: vi.fn(() => ({
    config: {
      secretScan: { enabled: false },
      architectureChecks: { enabled: false, rules: [], deriveFromDecisions: false },
      decisionChecks: { enabled: false, blockOnHighConfidence: true, minimumBlockingConfidence: 0.8 },
    },
    source: "file" as const,
  })),
}));

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: vi.fn(async () => [] as { id: string; decision: string }[]),
  runDecisionCheck: vi.fn(async () => ({ violations: [] as never[] })),
}));

import { checkGeneratedFile } from "../src/preflight/generated";

describe("R6-238 generated-file gate must not use server cwd config", () => {
  it("still blocks a hardcoded secret when cwd config disables secretScan", async () => {
    const verdict = await checkGeneratedFile(
      "repo-123",
      "src/generated.ts",
      'const key = "AKIA1234567890ABCD12";\n',
    );
    expect(verdict.blocked).toBe(true);
    expect(verdict.problems.some((p) => p.startsWith("secret-scan:"))).toBe(true);
  });
});
