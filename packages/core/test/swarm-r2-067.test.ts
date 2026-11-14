import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/db", () => ({ getDb: vi.fn(), decisions: {} }));
vi.mock("../src/ai", () => ({ getAI: vi.fn() }));
vi.mock("../src/ai/prompts", () => ({
  consolidatePrompt: vi.fn(() => "consolidate"),
  extractDocPrompt: vi.fn(() => "doc"),
  extractPrompt: vi.fn(() => "extract"),
  filterExtractedDecisionsToBatch: vi.fn((cleaned: unknown) => cleaned),
}));
vi.mock("../src/github/app", () => ({ getInstallationOctokit: vi.fn() }));
vi.mock("../src/github/fetchers", () => ({
  buildPrBatchText: vi.fn(() => "batch"),
  fetchClosedPRs: vi.fn(),
  fetchDocs: vi.fn(),
}));
vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: vi.fn(),
  decisionHeadroom: vi.fn(),
}));
vi.mock("../src/pipelines/upsert-decisions", () => ({ upsertDecisions: vi.fn() }));

import { getAI } from "../src/ai";
import { getInstallationOctokit } from "../src/github/app";
import { fetchClosedPRs, fetchDocs } from "../src/github/fetchers";
import { runExtract } from "../src/pipelines/extract";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";
import { decisionHeadroom, isRepoWithinPlan } from "../src/services/plan-guard";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("R2-067 null LLM element", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(isRepoWithinPlan).mockResolvedValue({ ok: true, plan: "free", limit: -1 });
    asMock(decisionHeadroom).mockResolvedValue({ ok: true, used: 0, limit: -1, plan: "free" });
    asMock(getInstallationOctokit).mockResolvedValue({});
    asMock(fetchClosedPRs).mockResolvedValue([
      { number: 1, title: "a", body: "", merged: true, state: "merged", discussion: "" },
      { number: 2, title: "b", body: "", merged: true, state: "merged", discussion: "" },
    ]);
    asMock(fetchDocs).mockResolvedValue([
      { path: "docs/adr-001.md", type: "adr", sha: "x", content: "doc" },
    ]);
    asMock(upsertDecisions).mockResolvedValue({ inserted: 1, updated: 0 });
    const completeJSON = vi.fn(async (prompt: string) => {
      if (prompt === "consolidate") return [null];
      if (prompt === "doc")
        return [null, { decision: "Doc rule", why: "", examples: [], evidence: [] }];
      return [
        { decision: "Rule one", why: "", examples: [], evidence: ["PR #1"] },
        { decision: "Rule two", why: "", examples: [], evidence: ["PR #2"] },
      ];
    });
    asMock(getAI).mockReturnValue({ name: "fake", complete: vi.fn(), completeJSON });
  });

  it("ignores [null] from consolidate and doc extraction without crashing", async () => {
    const result = await runExtract({
      repoId: "repo-1",
      installationId: 1,
      owner: "o",
      name: "r",
      defaultBranch: "main",
    });
    expect(result.extracted).toBe(2);
    expect(result.consolidated).toBe(0);
    expect(result.docDecisions).toBe(1);
    expect(result.inserted).toBe(1);
    expect(asMock(upsertDecisions).mock.calls[0][1]).toHaveLength(1);
  });
});
