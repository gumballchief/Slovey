import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeJSON } = vi.hoisted(() => ({ completeJSON: vi.fn() }));

vi.mock("@company-brain/db", () => ({
  decisions: { id: "id", decision: "decision", evidence: "evidence", title: "title", repoId: "repoId", status: "status" },
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "dec1", decision: "Redis was rejected and must not be used", evidence: [], title: "No Redis" },
            ]),
        }),
      }),
    }),
  }),
}));

vi.mock("../src/ai", () => ({ getAI: () => ({ completeJSON }) }));
vi.mock("../src/pipelines/retrieve", () => ({ retrieveDecisions: vi.fn(async () => []) }));

import { runDecisionCheck } from "../src/preflight/decisions";

const diff = "import Redis from 'redis';";

describe("runDecisionCheck malformed AI violations", () => {
  beforeEach(() => completeJSON.mockReset());

  it("falls back to keyword mode when violations is not an array", async () => {
    completeJSON.mockResolvedValue({ violations: {} });
    const result = await runDecisionCheck("repo1", diff, ["a.ts"]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.decisionId).toBe("dec1");
  });

  it("falls back to keyword mode when a violation entry is null", async () => {
    completeJSON.mockResolvedValue({ violations: [null] });
    const result = await runDecisionCheck("repo1", diff, ["a.ts"]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.decisionId).toBe("dec1");
  });

  it("still reports well-formed violations", async () => {
    completeJSON.mockResolvedValue({
      violations: [{ decisionId: "dec1", violation: "Diff uses Redis", confidence: 0.8 }],
    });
    const result = await runDecisionCheck("repo1", diff, ["a.ts"]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.violation).toBe("Diff uses Redis");
  });
});
