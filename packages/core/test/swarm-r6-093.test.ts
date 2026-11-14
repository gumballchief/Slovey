import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sets: [] as Array<Record<string, unknown>>,
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  desc: (...a: unknown[]) => a,
}));

vi.mock("@company-brain/db", () => ({
  agentRuns: { id: "id", repoId: "repoId", status: "status" },
  getDb: () => ({
    update: (_t: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        state.sets.push(vals);
        return {
          where: (_c: unknown) => {
            if (vals["status"] === "running") {
              return {
                returning: async () => [{ id: "run-1", repoId: "repo-1", intent: "do thing" }],
              };
            }
            if (vals["status"] === "ready") {
              return { returning: () => Promise.reject(new Error("db connection lost")) };
            }
            return Promise.resolve([]);
          },
        };
      },
    }),
  }),
}));

vi.mock("../src/services/sync", () => ({
  resolveRepoById: async () => ({
    repoId: "repo-1",
    owner: "o",
    name: "r",
    fullName: "o/r",
    defaultBranch: "main",
    installationGithubId: 123,
  }),
}));

vi.mock("../src/pipelines/agent", () => ({
  runAgentTask: async () => ({
    branch: "agent/task",
    prNumber: 123,
    prUrl: "https://github.com/o/r/pull/123",
    draft: false,
    path: "a.ts",
    isNew: true,
    files: [{ path: "a.ts", isNew: true }],
    decisionsUsed: 1,
    verdict: "approve",
    reviewPosted: true,
    preflightRevised: false,
    reviseRounds: 0,
    ciState: "passing",
    ciSummary: "ok",
  }),
}));

import { executeAgentRun } from "../src/services/agent-runs";

describe("R6-093 orphaned PR on ready-update failure", () => {
  it("persists branch/prNumber/prUrl even when the ready update fails", async () => {
    state.sets.length = 0;
    await executeAgentRun("run-1");
    const last = state.sets[state.sets.length - 1];
    expect(last["prNumber"]).toBe(123);
    expect(last["prUrl"]).toBe("https://github.com/o/r/pull/123");
    expect(last["branch"]).toBe("agent/task");
  });
});
