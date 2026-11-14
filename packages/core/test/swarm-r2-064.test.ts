import { describe, it, expect, vi } from "vitest";

vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: vi.fn(async () => ({ ok: true, plan: "free", limit: 5 })),
  decisionHeadroom: vi.fn(async () => ({ ok: false, used: 10, limit: 10, plan: "free" })),
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: vi.fn(async () => ({})),
}));

vi.mock("../src/github/fetchers", () => ({
  buildPrBatchText: vi.fn(() => "PR #1"),
  fetchClosedPRs: vi.fn(async () => [
    { number: 1, title: "t", body: "b", merged: true, state: "merged", discussion: "d" },
  ]),
  fetchDocs: vi.fn(async () => []),
}));

vi.mock("../src/ai", () => ({
  getAI: vi.fn(() => ({
    name: "fake",
    complete: vi.fn(async () => ""),
    completeJSON: vi.fn(async () => [
      { decision: "Use X", why: "r", examples: ["ex"], evidence: ["PR #1"], category: "architecture" },
      { decision: "Use Y", why: "r", examples: ["ex"], evidence: ["PR #1"], category: "architecture" },
      { decision: "Use Z", why: "r", examples: ["ex"], evidence: ["PR #1"], category: "architecture" },
    ]),
  })),
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 3, updated: 0 })),
}));

import { runExtract } from "../src/pipelines/extract";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

describe("R2-064 decision-count headroom", () => {
  it("does not bulk insert when decision allowance is exhausted", async () => {
    const result = await runExtract({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      defaultBranch: "main",
      prLimit: 5,
    });
    expect(upsertDecisions).not.toHaveBeenCalled();
    expect(result.aborted).toMatch(/plan-limit/);
    expect(result.inserted).toBe(0);
  });
});
