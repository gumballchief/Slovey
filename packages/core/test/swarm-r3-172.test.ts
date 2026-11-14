import { describe, it, expect, vi } from "vitest";
import { getDb } from "@company-brain/db";
import { updateDecision } from "../src/services/dashboard";

vi.mock("@company-brain/db", () => ({
  agentRuns: {},
  auditLogs: {},
  decisions: { id: "id", repoId: "repoId", status: "status" },
  feedback: {},
  installations: {},
  memberships: {},
  organizations: {},
  prChecks: {},
  repoKnowledge: {},
  repoSettings: {},
  repos: {},
  users: {},
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  desc: (x: unknown) => x,
  eq: (a: unknown, b: unknown) => ({ a, b }),
  ilike: (a: unknown, b: unknown) => ({ a, b }),
  inArray: (a: unknown, b: unknown) => ({ a, b }),
  ne: (a: unknown, b: unknown) => ({ a, b }),
  or: (...args: unknown[]) => args,
  sql: Object.assign((...args: unknown[]) => ({}), { raw: () => ({}) }),
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0, 0, 0] }),
}));

vi.mock("../src/queue", () => ({
  enqueue: async () => null,
  JOBS: { extract: "extract" },
}));

vi.mock("../src/memory", () => ({
  reinforce: async () => {},
}));

describe("R3-172 removed decision resurrection", () => {
  it("blocks removed -> approved via updateDecision", async () => {
    const removedRow = {
      id: "d1",
      repoId: "r1",
      decision: "x",
      why: "y",
      examples: [],
      evidence: [],
      source: "github_pr",
      status: "removed",
      createdAt: new Date(),
    };
    let updateCalled = false;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [removedRow],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              updateCalled = true;
              return [{ ...removedRow, status: "approved" }];
            },
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    await expect(updateDecision("r1", "d1", { status: "approved" })).rejects.toThrow();
    expect(updateCalled).toBe(false);
  });
});
