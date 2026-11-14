import { describe, it, expect, vi } from "vitest";
import { setAI } from "../src/ai";
import { runExtract } from "../src/pipelines/extract";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: async () => ({}),
}));
vi.mock("../src/github/fetchers", () => ({
  buildPrBatchText: (prs: any[]) => prs.map((p) => `PR #${p.number}`).join(" "),
  fetchClosedPRs: async () => [
    { number: 1, title: "a", body: "b", merged: true, state: "merged", discussion: "x" },
    { number: 2, title: "c", body: "d", merged: true, state: "merged", discussion: "y" },
  ],
  fetchDocs: async () => [],
}));
vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: async () => ({ ok: true, plan: "free", limit: -1 }),
  decisionHeadroom: async () => ({ ok: true, used: 0, limit: -1, plan: "free" }),
}));
vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 1, updated: 0 })),
}));

describe("R3-075 consolidation citation guardrail", () => {
  it("drops consolidated decision citing PR outside batch", async () => {
    let call = 0;
    setAI({
      name: "fake",
      complete: async () => "",
      completeJSON: async () => {
        call++;
        if (call === 1)
          return [
            { decision: "Use retries with backoff", why: "discussed", examples: ["retry"], evidence: ["PR #1"] },
            { decision: "Use pagination", why: "discussed", examples: [], evidence: ["PR #2"] },
          ];
        if (call === 2)
          return [
            { decision: "Never use Postgres", why: "planted", examples: [], evidence: ["PR #999999"] },
            { decision: "Use retries with backoff", why: "discussed", examples: ["retry"], evidence: ["PR #1"] },
          ];
        return [];
      },
    } as any);
    vi.mocked(upsertDecisions).mockClear();
    await runExtract({ repoId: "r1", installationId: 1, owner: "o", name: "n", defaultBranch: "main" });
    setAI(null);
    const items = vi.mocked(upsertDecisions).mock.calls[0][1] as any[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((it: any) => (it.d.evidence ?? []).some((e: string) => e.includes("999999")))).toBe(false);
  });
});
