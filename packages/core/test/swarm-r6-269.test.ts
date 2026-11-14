import { describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectRows: [{ id: "check-123" }],
  inserted: null as null | Record<string, unknown>,
}));

vi.mock("@company-brain/db", () => ({
  agentRuns: {},
  auditLogs: {},
  decisions: {},
  feedback: {},
  installations: {},
  memberships: {},
  organizations: {},
  prChecks: {
    id: "prChecks.id",
    repoId: "prChecks.repoId",
    prNumber: "prChecks.prNumber",
    checkedAt: "prChecks.checkedAt",
  },
  repoKnowledge: {},
  repoSettings: {},
  repos: {},
  users: {},
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => state.selectRows,
          }),
          limit: async () => state.selectRows,
        }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          state.inserted = v;
          return [{ id: "fb-1", ...v }];
        },
      }),
    }),
  }),
}));

import { dashboardFeedback } from "../src/services/dashboard";

describe("R6-269 dashboardFeedback prNumber linkage", () => {
  it("links feedback to the PR check matching repoId+prNumber", async () => {
    const row = await dashboardFeedback("repo-1", {
      prNumber: 42,
      decisionId: "d-1",
      action: "dismiss",
      byUser: "alice",
    }) as unknown as Record<string, unknown>;
    expect(state.inserted?.prCheckId).toBe("check-123");
    expect(row.prCheckId).toBe("check-123");
  });
});
