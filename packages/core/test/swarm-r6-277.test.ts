import { describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  agentRuns: {},
  auditLogs: {},
  decisions: {},
  feedback: {},
  installations: {},
  memberships: {},
  organizations: {},
  prChecks: {},
  repoKnowledge: {},
  repoSettings: {},
  repos: {},
  users: {},
}));

import { getDb } from "@company-brain/db";
import { PLAN_LIMITS } from "../src/services/dashboard";
import { decisionHeadroom, isRepoWithinPlan } from "../src/services/plan-guard";

function chainable(rows: unknown[], shouldThrow: boolean) {
  const builder = {
    from() {
      return builder;
    },
    innerJoin() {
      return builder;
    },
    where() {
      return builder;
    },
    limit() {
      if (shouldThrow) return Promise.reject(new Error("pooler reset"));
      return Promise.resolve(rows);
    },
    then(
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown,
    ) {
      if (shouldThrow) return Promise.reject(new Error("pooler reset")).then(resolve, reject);
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
  return builder;
}

describe("R6-277 fail-open on count query error", () => {
  it("isRepoWithinPlan returns ok:true when rank count fails", async () => {
    const entry = Object.entries(PLAN_LIMITS).find(([, v]) => v.repos >= 0);
    if (!entry) return;
    const infoRow = {
      orgId: "org-1",
      plan: entry[0],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      repoId: "repo-1",
    };
    vi.mocked(getDb).mockReset();
    vi.mocked(getDb).mockReturnValueOnce({ select: () => chainable([infoRow], false) } as never);
    vi.mocked(getDb).mockReturnValueOnce({ select: () => chainable([], true) } as never);
    const res = await isRepoWithinPlan("repo-1");
    expect(res.ok).toBe(true);
  });

  it("decisionHeadroom returns ok:true when count fails", async () => {
    const entry = Object.entries(PLAN_LIMITS).find(([, v]) => v.decisions >= 0);
    if (!entry) return;
    const infoRow = {
      orgId: "org-1",
      plan: entry[0],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      repoId: "repo-1",
    };
    vi.mocked(getDb).mockReset();
    vi.mocked(getDb).mockReturnValueOnce({ select: () => chainable([infoRow], false) } as never);
    vi.mocked(getDb).mockReturnValueOnce({ select: () => chainable([], true) } as never);
    const res = await decisionHeadroom("repo-1");
    expect(res.ok).toBe(true);
  });
});
