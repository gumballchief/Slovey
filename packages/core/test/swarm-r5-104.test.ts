import { describe, it, expect, vi } from "vitest";

vi.mock("../src/preflight/config", () => ({
  loadPreflightConfig: () => ({
    config: {
      secretScan: { enabled: true },
      architectureChecks: { enabled: false, rules: [], deriveFromDecisions: false },
      decisionChecks: { enabled: true, blockOnHighConfidence: false, minimumBlockingConfidence: 0 },
    },
    source: "default" as const,
  }),
  CONFIG_FILENAME: "companybrain.preflight.json",
}));

vi.mock("../src/preflight/decisions", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/decisions")>();
  return {
    ...orig,
    fetchRejectedDecisions: vi.fn(async () => []),
    runDecisionCheck: vi.fn(async () => ({ violations: [] })),
  };
});

import { checkGeneratedFile } from "../src/preflight/generated";
import { runDecisionCheck } from "../src/preflight/decisions";

describe("R5-104: generated-file decision check must not send raw secrets to LLM", () => {
  it("redacts ghp_ secret from the diff passed to runDecisionCheck", async () => {
    const secret = `ghp_${"A".repeat(36)}`;
    const content = `const token = "${secret}";\nconsole.log("hi");`;
    await checkGeneratedFile("repo-1", "generated.ts", content);
    expect(vi.mocked(runDecisionCheck).mock.calls.length).toBe(1);
    const diff = vi.mocked(runDecisionCheck).mock.calls[0]![1] as string;
    expect(diff).not.toContain(secret);
    expect(diff).toContain("[REDACTED]");
  });
});
