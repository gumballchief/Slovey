import { describe, it, expect, vi, beforeEach } from "vitest";

const dbState = vi.hoisted(() => ({
  txCount: 0,
  txDeletes: 0,
  txInserts: 0,
  directDeletes: 0,
  directInserts: 0,
}));

vi.mock("@company-brain/db", () => {
  const tx = {
    delete: () => ({
      where: async () => {
        dbState.txDeletes += 1;
      },
    }),
    insert: () => ({
      values: async () => {
        dbState.txInserts += 1;
      },
    }),
  };
  return {
    repoKnowledge: { repoId: "repoId", kind: "kind", data: "data" },
    getDb: () => ({
      delete: () => ({
        where: async () => {
          dbState.directDeletes += 1;
        },
      }),
      insert: () => ({
        values: async () => {
          dbState.directInserts += 1;
        },
      }),
      transaction: async (cb: (t: typeof tx) => Promise<void>) => {
        dbState.txCount += 1;
        await cb(tx);
      },
    }),
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: async () => ({
    rest: {
      git: {
        getTree: async () => ({
          data: { tree: [{ type: "blob", path: "package.json", sha: "s1" }] },
        }),
        getBlob: async () => ({
          data: {
            content: Buffer.from(
              JSON.stringify({ name: "pkg", dependencies: { next: "1" }, devDependencies: {} }),
            ).toString("base64"),
          },
        }),
      },
    },
  }),
}));

vi.mock("../src/ai", () => ({
  getAI: () => ({
    completeJSON: async () => ({ summary: "arch" }),
  }),
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: async () => ({ inserted: 0, updated: 0 }),
}));

describe("R6-044 atomic repo_knowledge replace", () => {
  beforeEach(() => {
    dbState.txCount = 0;
    dbState.txDeletes = 0;
    dbState.txInserts = 0;
    dbState.directDeletes = 0;
    dbState.directInserts = 0;
  });

  it("persists architecture + dependency_graph inside one transaction", async () => {
    const { runIndexRepo } = await import("../src/pipelines/index-repo");
    await runIndexRepo({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      defaultBranch: "main",
    });
    expect(dbState.txCount).toBe(1);
    expect(dbState.txDeletes).toBe(2);
    expect(dbState.txInserts).toBe(1);
    expect(dbState.directDeletes).toBe(0);
    expect(dbState.directInserts).toBe(0);
  });
});
