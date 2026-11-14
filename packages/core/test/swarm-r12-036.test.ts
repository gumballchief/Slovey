import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existing: { repoId: "r1", confidenceThreshold: "low" },
  conflictHandled: false,
  selectCalls: 0,
}));

vi.mock("@company-brain/db", () => {
  const table = { repoId: "repoId" };
  const fakeDb = {
    select: () => {
      state.selectCalls++;
      const isFirst = state.selectCalls === 1;
      const builder: Record<string, unknown> = {
        from: () => builder,
        where: () => builder,
        limit: () => builder,
        orderBy: () => builder,
        then: (resolve: (v: unknown) => void) => resolve(isFirst ? [] : [state.existing]),
      };
      return builder;
    },
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => {
          state.conflictHandled = true;
          return { returning: async () => [] };
        },
        returning: async () => {
          throw new Error("duplicate key value violates unique constraint");
        },
      }),
    }),
  };
  return {
    agentRuns: {},
    auditLogs: {},
    decisions: {},
    feedback: {},
    getDb: () => fakeDb,
    installations: {},
    memberships: {},
    organizations: {},
    prChecks: {},
    repoKnowledge: {},
    repoSettings: table,
    repos: {},
    users: {},
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  desc: (v: unknown) => v,
  eq: (a: unknown, b: unknown) => ({ a, b }),
  ilike: (a: unknown, b: unknown) => ({ a, b }),
  inArray: (a: unknown, b: unknown) => ({ a, b }),
  ne: (a: unknown, b: unknown) => ({ a, b }),
  or: (...args: unknown[]) => args,
  sql: () => ({}),
}));

import { getSettings } from "../src/services/dashboard";

describe("getSettings concurrent insert race", () => {
  it("returns existing row instead of throwing on unique conflict", async () => {
    await expect(getSettings("r1")).resolves.toEqual(state.existing);
    expect(state.conflictHandled).toBe(true);
  });
});
