import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  agentRuns: {},
  auditLogs: {},
  decisions: {},
  feedback: {},
  installations: {},
  memberships: {},
  organizations: {},
  prChecks: { repoId: {}, checkedAt: {} },
  repoKnowledge: {},
  repoSettings: {},
  repos: {},
  users: {},
  getDb: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { listPRChecks } from "../src/services/dashboard";

function makeRow(i: number) {
  return {
    prNumber: i,
    prTitle: `PR ${i}`,
    prAuthor: "alice",
    verdict: "clear",
    matchedDecisionId: null,
    explanation: "explanation text",
    severity: null,
    suggestedFix: null,
    checkedAt: new Date(),
    repoId: "repo-1",
  };
}

function makeDb(rows: ReturnType<typeof makeRow>[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
            then: (res: (v: typeof rows) => unknown, rej?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(res, rej),
          }),
        }),
      }),
    }),
  };
}

describe("R8-070 listPRChecks limit", () => {
  it("does not materialize unbounded history", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => makeRow(i));
    vi.mocked(getDb).mockReturnValue(makeDb(rows) as unknown as ReturnType<typeof getDb>);
    const out = await listPRChecks("repo-1");
    expect(out.length).toBeLessThanOrEqual(100);
  });
});
