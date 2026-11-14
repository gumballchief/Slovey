import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: async () => ({ ok: true, plan: "free", limit: -1 }),
  decisionHeadroom: async () => ({ ok: true, used: 0, limit: -1, plan: "free" }),
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: async () => ({}),
}));

vi.mock("../src/github/fetchers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/github/fetchers")>();
  return {
    ...actual,
    fetchClosedPRs: async () => [
      { number: 1, title: "t1", body: "b1", merged: true, state: "merged" as const, discussion: "" },
      { number: 2, title: "t2", body: "b2", merged: true, state: "merged" as const, discussion: "" },
    ],
    fetchDocs: async () => [],
  };
});

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: async () => ({ inserted: 0, updated: 0 }),
}));

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [{ n: 0 }],
      }),
    }),
  }),
  decisions: { repoId: "repoId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  sql: () => ({}),
  and: () => ({}),
}));

import { setAI } from "../src/ai";
import { runExtract } from "../src/pipelines/extract";

const params = { repoId: "r1", installationId: 1, owner: "o", name: "n", defaultBranch: "main" };

describe("R10-167 extraction failure signal", () => {
  it("aborts when every batch returns null", async () => {
    setAI({ name: "fake", complete: async () => "", completeJSON: async () => null });
    try {
      const res = await runExtract(params);
      expect(res.prsFetched).toBe(2);
      expect(res.aborted).toBe("extraction-failed");
      expect(res.inserted).toBe(0);
    } finally {
      setAI(null);
    }
  });

  it("does not abort on a valid empty array", async () => {
    setAI({ name: "fake", complete: async () => "", completeJSON: async () => [] });
    try {
      const res = await runExtract(params);
      expect(res.aborted).toBeUndefined();
    } finally {
      setAI(null);
    }
  });
});
