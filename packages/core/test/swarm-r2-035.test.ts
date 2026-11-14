import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => {
  const decisions = {
    __t: "decisions",
    id: { _field: "id" },
    repoId: { _field: "repoId" },
  };
  const decisionEdges = {
    __t: "edges",
    id: { _field: "id" },
    repoId: { _field: "repoId" },
    fromDecisionId: { _field: "fromDecisionId" },
    toDecisionId: { _field: "toDecisionId" },
    type: { _field: "type" },
  };
  const decisionVersions = { __t: "versions" };
  return { decisions, decisionEdges, decisionVersions, getDb: vi.fn() };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: unknown) => ({ op: "eq", col, val }),
  and: (...conds: any[]) => ({ op: "and", conds }),
  or: (...conds: any[]) => ({ op: "or", conds }),
  inArray: (col: any, vals: unknown[]) => ({ op: "inArray", col, vals }),
  desc: (x: any) => ({ op: "desc", x }),
  getTableColumns: () => ({}),
  sql: Object.assign((s: any, ...a: any[]) => ({ op: "sql", s, a }), {}),
}));

import { getDb } from "@company-brain/db";
import { traverse } from "../src/graph/service";

function evalCond(row: any, cond: any): boolean {
  if (!cond || !cond.op) return true;
  if (cond.op === "eq") return row[cond.col._field] === cond.val;
  if (cond.op === "inArray") return (cond.vals as unknown[]).includes(row[cond.col._field]);
  if (cond.op === "and") return cond.conds.every((c: any) => evalCond(row, c));
  if (cond.op === "or") return cond.conds.some((c: any) => evalCond(row, c));
  return true;
}

function makeFakeDb(decisionRows: any[], edgeRows: any[]) {
  return {
    select: (_cols?: any) => ({
      from: (table: any) => ({
        where: (cond: any) => {
          const all = table.__t === "decisions" ? decisionRows : edgeRows;
          const filtered = all.filter((r) => evalCond(r, cond));
          return {
            limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
            then: (res: any, rej: any) => Promise.resolve(filtered).then(res, rej),
          };
        },
      }),
    }),
  };
}

const nodeA = { id: "a1", repoId: "repo-A", title: "own decision" };
const victim = { id: "victim-1", repoId: "repo-B", title: "secret decision" };
const linkEdge = {
  id: "e1",
  repoId: "repo-A",
  fromDecisionId: "a1",
  toDecisionId: "victim-1",
  type: "related",
};

beforeEach(() => {
  vi.mocked(getDb).mockReset();
});

describe("R2-035 traverse repo isolation", () => {
  it("does not leak cross-repo decision via foreign startId", async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDb([nodeA, victim], [linkEdge]) as any);
    const res = await traverse("repo-A", "victim-1", { depth: 1 });
    expect(res.nodes).toEqual([]);
    expect(res.edges).toEqual([]);
  });

  it("does not include cross-repo node reached via edge", async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDb([nodeA, victim], [linkEdge]) as any);
    const res = await traverse("repo-A", "a1", { depth: 1 });
    expect(res.nodes.map((n: any) => n.id)).toContain("a1");
    expect(res.nodes.map((n: any) => n.id)).not.toContain("victim-1");
  });
});
