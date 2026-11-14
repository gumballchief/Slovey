import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("drizzle-orm", () => {
  const eq = (col: any, val: any) => ({ __eq: true, col, val });
  const inArray = (col: any, vals: any[]) => ({ __in: true, col, vals });
  const and = (...conds: any[]) => ({ __and: true, conds: conds.flat() });
  const or = (...conds: any[]) => ({ __or: true, conds });
  const desc = (col: any) => ({ __desc: true, col });
  const getTableColumns = (t: any) => t;
  const sql = (strings: any, ...vals: any[]) => ({ __sql: true, strings, vals });
  return { eq, and, or, inArray, desc, sql, getTableColumns };
});

vi.mock("@company-brain/db", () => {
  const decisions = { id: "id", repoId: "repoId", review: "review", status: "status", confidence: "confidence", version: "version", approvedAt: "approvedAt", updatedAt: "updatedAt", createdAt: "createdAt" };
  const decisionEdges = { id: "id" };
  const decisionVersions = { decisionId: "decisionId" };
  function matches(row: any, cond: any): boolean {
    if (!cond) return true;
    if (cond.__and) return cond.conds.every((c: any) => matches(row, c));
    if (cond.__or) return cond.conds.some((c: any) => matches(row, c));
    if (cond.__eq) return row[cond.col] === cond.val;
    if (cond.__in) return cond.vals.includes(row[cond.col]);
    return true;
  }
  const fakeDb = {
    select: () => ({
      from: (_t: any) => ({
        where: (cond: any) => ({
          limit: async (n: number) => {
            const store: Map<string, any> = (globalThis as any).__store;
            if (!store) return [];
            return [...store.values()].filter((r) => matches(r, cond)).slice(0, n);
          },
        }),
      }),
    }),
    update: (_t: any) => ({
      set: (setObj: any) => ({
        where: (cond: any) => ({
          returning: async () => {
            (globalThis as any).__lastUpdateWhere = cond;
            const store: Map<string, any> = (globalThis as any).__store;
            if (!store) return [];
            const matched = [...store.values()].filter((r) => matches(r, cond));
            if (matched.length === 0) return [];
            const row = matched[0];
            let newConf = row.confidence;
            if (setObj.confidence !== undefined) {
              if (setObj.confidence && setObj.confidence.__sql) newConf = Math.min(0.99, row.confidence + 0.1);
              else newConf = setObj.confidence;
            }
            const updated = { ...row, ...setObj, confidence: newConf, version: (row.version ?? 1) + 1 };
            store.set(row.id, updated);
            return [updated];
          },
        }),
      }),
    }),
    insert: (_t: any) => ({ values: async (_v: any) => {} }),
  };
  const getDb = () => fakeDb;
  return { decisions, decisionEdges, decisionVersions, getDb };
});

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [] }),
}));

import { reviewDecision } from "../src/graph/service";

describe("R2-041 reviewDecision state guard", () => {
  beforeEach(() => {
    (globalThis as any).__store = new Map<string, any>();
    (globalThis as any).__lastUpdateWhere = null;
  });

  it("does not resurrect a rejected decision", async () => {
    (globalThis as any).__store.set("d1", { id: "d1", repoId: "r1", status: "rejected", review: "unreviewed", confidence: 0.5, version: 1, approvedAt: null });
    const res = await reviewDecision("r1", "d1", "approve", { by: "u" });
    expect(res).toBeNull();
    expect((globalThis as any).__store.get("d1").status).toBe("rejected");
  });

  it("does not re-approve an already-confirmed decision", async () => {
    (globalThis as any).__store.set("d2", { id: "d2", repoId: "r1", status: "approved", review: "confirmed", confidence: 0.8, version: 2, approvedAt: new Date() });
    const res = await reviewDecision("r1", "d2", "approve", {});
    expect(res).toBeNull();
    expect((globalThis as any).__store.get("d2").confidence).toBeCloseTo(0.8);
  });

  it("approve UPDATE is atomically guarded on review/status", async () => {
    (globalThis as any).__store.set("d3", { id: "d3", repoId: "r1", status: "candidate", review: "unreviewed", confidence: 0.5, version: 1, approvedAt: null });
    const res = await reviewDecision("r1", "d3", "approve", {});
    expect(res).not.toBeNull();
    expect(res!.confidence).toBeCloseTo(0.6);
    const dumped = JSON.stringify((globalThis as any).__lastUpdateWhere);
    expect(dumped).toContain("unreviewed");
    expect(dumped).toContain("candidate");
  });
});
