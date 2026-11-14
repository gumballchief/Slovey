import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  return {
    status: "proposed",
    version: 1,
    versions: [] as Array<Record<string, unknown>>,
    failSnapshot: true,
    transactionCalled: false,
  };
});

vi.mock("@company-brain/db", () => {
  const decisions = { id: "id", repoId: "repoId", version: "version", status: "status" };
  const decisionVersions = { decisionId: "decisionId" };
  const decisionEdges = {};
  type SetShape = Record<string, unknown>;
  const fakeDb = {
    update: (_table: unknown) => ({
      set: (set: SetShape) => ({
        where: (..._w: unknown[]) => ({
          returning: async () => {
            hoisted.version += 1;
            const s = set["status"];
            if (typeof s === "string") hoisted.status = s;
            return [{ id: "d1", repoId: "r1", status: hoisted.status, version: hoisted.version }];
          },
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: async (v: unknown) => {
        if (hoisted.failSnapshot) throw new Error("snapshot boom");
        hoisted.versions.push(v as Record<string, unknown>);
      },
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      hoisted.transactionCalled = true;
      const savedStatus = hoisted.status;
      const savedVersion = hoisted.version;
      const holder: { pending: Array<Record<string, unknown>> } = { pending: [] };
      const tx = {
        update: (_table: unknown) => ({
          set: (set: SetShape) => ({
            where: (..._w: unknown[]) => ({
              returning: async () => {
                const s = set["status"];
                const nextStatus = typeof s === "string" ? s : savedStatus;
                return [{ id: "d1", repoId: "r1", status: nextStatus, version: savedVersion + 1 }];
              },
            }),
          }),
        }),
        insert: (_table: unknown) => ({
          values: async (v: unknown) => {
            if (hoisted.failSnapshot) throw new Error("snapshot boom");
            holder.pending.push(v as Record<string, unknown>);
          },
        }),
      };
      try {
        const result = await fn(tx);
        const r = result as { status?: unknown; version?: unknown } | null;
        if (r && typeof r.status === "string" && typeof r.version === "number") {
          hoisted.status = r.status;
          hoisted.version = r.version;
        }
        for (const p of holder.pending) hoisted.versions.push(p);
        return result;
      } catch (e) {
        throw e;
      }
    },
  };
  return { decisions, decisionVersions, decisionEdges, getDb: () => fakeDb };
});

vi.mock("drizzle-orm", () => {
  return {
    and: (...args: unknown[]) => args,
    or: (...args: unknown[]) => args,
    eq: (...args: unknown[]) => args,
    inArray: (...args: unknown[]) => args,
    desc: (v: unknown) => v,
    getTableColumns: (v: unknown) => v,
    sql: (..._args: unknown[]) => ({}),
  };
});

import { transitionStatus } from "../src/graph/service";

describe("R6-023 status transition atomicity", () => {
  it("rolls back the status change when the snapshot fails", async () => {
    hoisted.status = "proposed";
    hoisted.version = 1;
    hoisted.versions = [];
    hoisted.failSnapshot = true;
    hoisted.transactionCalled = false;
    await expect(transitionStatus("r1", "d1", "rejected", { by: "u" })).rejects.toThrow("snapshot boom");
    expect(hoisted.transactionCalled).toBe(true);
    expect(hoisted.status).toBe("proposed");
    expect(hoisted.version).toBe(1);
    expect(hoisted.versions.length).toBe(0);
  });
});
