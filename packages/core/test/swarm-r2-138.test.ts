import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ calls: [] as any[] }));

vi.mock("@company-brain/db", () => {
  const col = (t: string, c: string) => ({ __t: t, __c: c });
  const repos: any = {
    __name: "repos",
    id: col("repos", "id"),
    fullName: col("repos", "fullName"),
    owner: col("repos", "owner"),
    ownerGithubId: col("repos", "ownerGithubId"),
    installationId: col("repos", "installationId"),
  };
  const installations: any = {
    __name: "installations",
    id: col("installations", "id"),
    orgId: col("installations", "orgId"),
    accountLogin: col("installations", "accountLogin"),
  };
  const decisions: any = {
    __name: "decisions",
    repoId: col("decisions", "repoId"),
    status: col("decisions", "status"),
  };
  const prChecks: any = {
    __name: "prChecks",
    repoId: col("prChecks", "repoId"),
    verdict: col("prChecks", "verdict"),
    checkedAt: col("prChecks", "checkedAt"),
  };
  function makeBuilder(sel: any) {
    const state: any = { select: sel, from: undefined, joins: [], where: undefined, groupBy: undefined };
    mocked.calls.push(state);
    const b: any = {};
    b.from = (t: any) => { state.from = t; return b; };
    b.innerJoin = (t: any, c: any) => { state.joins.push({ table: t, cond: c }); return b; };
    b.where = (c: any) => { state.where = c; return b; };
    b.groupBy = (...a: any[]) => { state.groupBy = a; return b; };
    b.then = (res: any, rej: any) =>
      Promise.resolve([]).then(() => {
        if (state.from && state.from.__name === "repos")
          return res([{ id: "r1", fullName: "o/r1", owner: "o", accountLogin: "o" }]);
        return res([]);
      }, rej);
    b.catch = (r: any) => b.then(undefined, r);
    return b;
  }
  return {
    repos,
    installations,
    decisions,
    prChecks,
    agentRuns: { __name: "agentRuns" },
    auditLogs: { __name: "auditLogs" },
    feedback: { __name: "feedback" },
    memberships: { __name: "memberships" },
    organizations: { __name: "organizations" },
    repoKnowledge: { __name: "repoKnowledge" },
    repoSettings: { __name: "repoSettings" },
    users: { __name: "users" },
    getDb: () => ({ select: (s: any) => makeBuilder(s) }),
  };
});

import { listRepos } from "../src/services/dashboard";

describe("R2-138: listRepos aggregates are tenant-scoped", () => {
  it("joins repos/installations and filters prChecks/decisions aggregates", async () => {
    mocked.calls.length = 0;
    await listRepos({ login: "alice", githubId: 999, orgIds: ["org-1"] });
    const agg = mocked.calls.filter(
      (c) => c.from && (c.from.__name === "prChecks" || c.from.__name === "decisions"),
    );
    expect(agg.length).toBe(3);
    for (const q of agg) {
      expect(q.joins.length).toBeGreaterThan(0);
      expect(q.where).toBeDefined();
    }
    const prQs = agg.filter((c) => c.from.__name === "prChecks");
    expect(prQs.length).toBe(2);
  });
});
