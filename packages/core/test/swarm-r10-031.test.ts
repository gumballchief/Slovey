import { describe, expect, it, vi } from "vitest";
import { checkPr } from "../src/pipelines/check";

const state = vi.hoisted(() => ({
  fetchCalls: 0,
  insertCalled: 0,
  commentCalled: 0,
}));

vi.mock("@company-brain/config", () => ({
  loadEnv: () => ({ ALLOWLIST_REPOS: [] }),
}));

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => {
        state.insertCalled += 1;
        return {
          onConflictDoUpdate: () => ({
            returning: async () => [{ id: "check-1" }],
          }),
        };
      },
    }),
  }),
  prChecks: { id: "id", repoId: "repoId", prNumber: "prNumber", headSha: "headSha", verdict: "verdict" },
  repoSettings: { repoId: "repoId", confidenceThreshold: "confidenceThreshold", triggerSynchronize: "triggerSynchronize", mode: "mode", learnFromDismissals: "learnFromDismissals" },
  decisions: { id: "id", decision: "decision", evidence: "evidence" },
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: async () => ({
    rest: { repos: { createCommitStatus: async () => ({}) } },
  }),
}));

vi.mock("../src/github/fetchers", () => ({
  fetchPrForCheck: async () => {
    state.fetchCalls += 1;
    if (state.fetchCalls === 1) {
      return { headSha: "abc123", title: "t", body: "b", author: "alice", changedFiles: [], diffSummary: "" };
    }
    throw new Error("GitHub rate-limited");
  },
  findBotComment: async () => null,
  postOrUpdateComment: async () => {
    state.commentCalled += 1;
    return 1;
  },
}));

vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: async () => ({ ok: true, plan: "free", limit: -1 }),
}));

vi.mock("../src/pipelines/retrieve", () => ({
  categorizePr: async () => null,
  retrieveDecisions: async () => [],
}));

vi.mock("../src/pipelines/feedback", () => ({
  getDismissedNotes: async () => [],
}));

vi.mock("../src/ai", () => ({
  getAI: () => ({ completeJSON: async () => null }),
}));

vi.mock("../src/services/audit", () => ({
  logAudit: async () => undefined,
}));

describe("R10-031 stale-head recheck must fail closed", () => {
  it("returns skipped/head-recheck-failed and posts/inserts nothing when recheck throws", async () => {
    const res = await checkPr({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      fullName: "o/n",
      prNumber: 1,
    });
    expect(res.verdict).toBe("skipped");
    expect(res.reason).toBe("head-recheck-failed");
    expect(res.posted).toBe(false);
    expect(state.insertCalled).toBe(0);
    expect(state.commentCalled).toBe(0);
  });
});
