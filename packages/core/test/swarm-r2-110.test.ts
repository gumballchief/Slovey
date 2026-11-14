import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const col = (table: string, name: string) => ({ __table: table, __col: name });
  const table = (name: string, cols: string[]) => {
    const t: any = { __table: name };
    for (const c of cols) t[c] = col(name, c);
    return t;
  };
  const tables = {
    preflightRuns: table("preflightRuns", ["id", "repoId", "branch", "createdAt"]),
    preflightAttempts: table("preflightAttempts", ["id", "repoId", "branch", "createdAt", "runId"]),
    preflightChecks: table("preflightChecks", ["id", "runId"]),
    preflightErrors: table("preflightErrors", ["id", "runId", "fingerprint"]),
    preflightFixInstructions: table("preflightFixInstructions", ["id", "runId"]),
    preflightDecisionViolations: table("preflightDecisionViolations", ["id", "runId"]),
  };
  const rows: Record<string, any[]> = {
    preflightRuns: [{ id: "victim-run-id", repoId: "victim-repo", branch: "main", commitSha: "abc123", summary: "secret" }],
    preflightAttempts: [],
    preflightChecks: [{ id: "c1", runId: "victim-run-id", name: "typecheck" }],
    preflightErrors: [{ id: "e1", runId: "victim-run-id", message: "secret error" }],
    preflightFixInstructions: [{ id: "f1", runId: "victim-run-id", problem: "secret fix" }],
    preflightDecisionViolations: [{ id: "v1", runId: "victim-run-id", title: "secret decision" }],
  };
  const evalPred = (pred: any, row: any): boolean => {
    if (!pred) return true;
    if (pred.type === "eq") return row[pred.col.__col] === pred.val;
    if (pred.type === "and") return pred.args.every((p: any) => evalPred(p, row));
    return true;
  };
  const fakeDb = {
    select: () => {
      let tbl: any;
      let pred: any;
      const resolve = () => (rows[tbl.__table] ?? []).filter((r: any) => evalPred(pred, r));
      const builder: any = {
        from: (t: any) => { tbl = t; return builder; },
        where: (p: any) => { pred = p; return builder; },
        orderBy: () => builder,
        limit: (n: number) => Promise.resolve(resolve().slice(0, n)),
        then: (onF: any, onR: any) => Promise.resolve(resolve()).then(onF, onR),
      };
      return builder;
    },
  };
  return { tables, fakeDb };
});

vi.mock("@company-brain/db", () => ({
  getDb: () => hoisted.fakeDb,
  preflightRuns: hoisted.tables.preflightRuns,
  preflightAttempts: hoisted.tables.preflightAttempts,
  preflightChecks: hoisted.tables.preflightChecks,
  preflightErrors: hoisted.tables.preflightErrors,
  preflightFixInstructions: hoisted.tables.preflightFixInstructions,
  preflightDecisionViolations: hoisted.tables.preflightDecisionViolations,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ type: "eq", col, val }),
  and: (...args: any[]) => ({ type: "and", args }),
  desc: (col: any) => ({ type: "desc", col }),
}));

import { getRunDetail } from "../src/preflight/persist";

describe("R2-110 getRunDetail tenant scoping", () => {
  it("does not return another repo's run", async () => {
    const result = await (getRunDetail as any)("victim-run-id", "attacker-repo");
    expect(result).toBeNull();
  });

  it("returns the run for its own repo", async () => {
    const result = await (getRunDetail as any)("victim-run-id", "victim-repo");
    expect(result?.run.id).toBe("victim-run-id");
    expect(result?.checks).toHaveLength(1);
  });
});
