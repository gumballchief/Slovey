import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const state = { queue: [] as unknown[] };
  const makeBuilder = (): any => {
    const builder: any = {};
    for (const m of ["select", "from", "where", "limit", "innerJoin", "leftJoin", "orderBy", "groupBy", "set", "returning", "for", "values"]) {
      builder[m] = () => builder;
    }
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(state.queue.shift()).then(onFulfilled, onRejected);
    return builder;
  };
  const fakeDb: any = {
    select: () => makeBuilder(),
    update: () => makeBuilder(),
    insert: () => makeBuilder(),
  };
  return { state, fakeDb };
});

vi.mock("@company-brain/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, getDb: () => hoisted.fakeDb };
});
vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2] }),
  setEmbeddings: () => {},
}));
vi.mock("../src/memory", () => ({ reinforce: async () => {} }));
vi.mock("../src/queue", () => ({ enqueue: async () => null, JOBS: { extract: "extract" } }));

import { updateDecision } from "../src/services/dashboard";

describe("R3-174 resurrecting removed decisions enforces plan limit", () => {
  it("rejects restoring a removed decision when org is at decision limit", async () => {
    const removed = {
      id: "dec-1",
      repoId: "repo-1",
      decision: "Use Postgres",
      why: "because",
      examples: [],
      evidence: [],
      source: "github_pr",
      status: "removed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // updateDecision current lookup, getOrgForRepo lookup, then getBilling's 5 queries (free plan, 200 decisions = limit)
    hoisted.state.queue = [
      [removed],
      [{ id: "org-1", name: "Org", slug: "org" }],
      [{ plan: "free" }],
      [{ n: 1 }],
      [{ n: 1 }],
      [{ n: 200 }],
      [{ prs: 0, conflicts: 0 }],
    ];
    await expect(updateDecision("repo-1", "dec-1", { status: "approved" })).rejects.toThrow(
      /Decision limit reached for free plan \(200\)/,
    );
  });
});
