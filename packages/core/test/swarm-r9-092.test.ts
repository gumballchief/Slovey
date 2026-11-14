import { describe, expect, it, vi } from "vitest";
import { checkGeneratedFile } from "../src/preflight/generated";
import { runDecisionCheck } from "../src/preflight/decisions";

vi.mock("../src/preflight/decisions", () => ({
  fetchRejectedDecisions: vi.fn(async () => []),
  runDecisionCheck: vi.fn(async () => ({ violations: [] })),
}));

describe("R9-092 generated gate padding bypass", () => {
  it("passes the violating tail past 12k to the decision check", async () => {
    const canary = "FORBIDDEN_TAIL_CANARY_R9_092_XYZ";
    const filler = "// benign filler line 0123456789\n".repeat(1500);
    const content = `${filler}${canary}\n`;
    await checkGeneratedFile("repo-1", "big.ts", content);
    const mocked = vi.mocked(runDecisionCheck);
    expect(mocked.mock.calls.length).toBeGreaterThan(0);
    const diff = mocked.mock.calls[0]![1] as string;
    expect(diff).toContain(canary);
  });
});
