import { describe, expect, it, vi } from "vitest";
import { setAI } from "../src/ai";

vi.mock("../src/github/app", () => ({ getInstallationOctokit: vi.fn(async () => ({})) }));
vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: vi.fn(async () => ({ ok: true, plan: "free", limit: -1 })),
  decisionHeadroom: vi.fn(async () => ({ ok: true, used: 0, limit: -1, plan: "free" })),
}));
vi.mock("../src/github/fetchers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/github/fetchers")>();
  return {
    ...actual,
    fetchClosedPRs: vi.fn(async () => [{ number: 1, title: "t", body: "b", merged: true, state: "merged", discussion: "d" }]),
    fetchDocs: vi.fn(async () => []),
  };
});
vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 1, updated: 0 })),
}));
vi.mock("@company-brain/db", () => ({ getDb: () => { throw new Error("db not needed"); }, decisions: {} }));

describe("R3-074 null LLM entry in PR extraction", () => {
  it("skips null entries instead of crashing", async () => {
    const { runExtract } = await import("../src/pipelines/extract");
    setAI({
      name: "fake",
      complete: async () => "",
      completeJSON: async () => [null, { decision: "Use X", why: "r", examples: [], evidence: ["PR #1"], category: "other" }],
    } as any);
    const res = await runExtract({ repoId: "r1", installationId: 1, owner: "o", name: "n", defaultBranch: "main", prLimit: 8 });
    expect(res.extracted).toBe(1);
    expect(res.prsFetched).toBe(1);
    setAI(null);
  });
});
