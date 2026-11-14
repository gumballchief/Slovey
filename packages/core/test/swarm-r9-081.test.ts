import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}) }));
vi.mock("@company-brain/db", () => ({
  decisions: { id: "id", decision: "decision", evidence: "evidence", title: "title", repoId: "repoId", status: "status" },
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  }),
}));
vi.mock("../src/pipelines/retrieve", () => ({
  retrieveDecisions: async (_repoId: string, pr: { body: string }) =>
    pr.body.includes("violatingTailToken")
      ? [{ id: "d-active", decision: "Never use violatingTailToken", why: "", examples: [], evidence: [], category: null, distance: 0 }]
      : [],
}));
vi.mock("../src/ai", () => ({
  getAI: () => ({
    completeJSON: async (prompt: string) =>
      prompt.includes("violatingTailToken") && prompt.includes("d-active")
        ? { violations: [{ decisionId: "d-active", violation: "Uses violatingTailToken", confidence: 0.95 }] }
        : { violations: [] },
  }),
}));

import { runDecisionCheck } from "../src/preflight/decisions";

describe("R9-081 active-decision violations beyond the judge cap", () => {
  it("judges the tail of a diff larger than 20000 chars", async () => {
    const diff = `${"a".repeat(21000)}\nconst x = violatingTailToken();`;
    const result = await runDecisionCheck("repo-1", diff, ["src/x.ts"]);
    expect(result.violations.map((v) => v.decisionId)).toContain("d-active");
  });
});

import { chunkDiffForJudge, JUDGE_DIFF_LIMIT, MAX_JUDGE_CHUNKS } from "../src/preflight/decisions";

describe("R9-081 judge calls stay bounded on huge diffs", () => {
  it("never makes more than MAX_JUDGE_CHUNKS judge calls and always includes the tail", () => {
    const diff = `${"a".repeat(1_000_000)}\nTAILMARK`;
    const chunks = chunkDiffForJudge(diff);
    expect(chunks.length).toBe(MAX_JUDGE_CHUNKS);
    expect(chunks.every((c) => c.length <= JUDGE_DIFF_LIMIT)).toBe(true);
    expect(chunks[chunks.length - 1]).toContain("TAILMARK");
  });
});
