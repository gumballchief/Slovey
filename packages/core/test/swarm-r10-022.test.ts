import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ committed: false, staged: false }));

vi.mock("@company-brain/db", async () => {
  const { integer, jsonb, pgTable, text, timestamp } = await import("drizzle-orm/pg-core");
  const decisions = pgTable("decisions", {
    id: text("id"),
    repoId: text("repo_id"),
    version: integer("version"),
    decision: text("decision"),
    title: text("title"),
    why: text("why"),
    examples: jsonb("examples"),
    updatedAt: timestamp("updated_at"),
  });
  const decisionVersions = pgTable("decision_versions", {
    id: text("id"),
    decisionId: text("decision_id"),
    version: integer("version"),
  });
  const decisionEdges = pgTable("decision_edges", {
    id: text("id"),
    repoId: text("repo_id"),
    fromDecisionId: text("from_decision_id"),
    toDecisionId: text("to_decision_id"),
  });
  const current = { id: "d1", repoId: "r1", version: 1, decision: "old", title: null, why: "", examples: [] };
  const updated = { ...current, version: 2, decision: "new" };
  const makeClient = (isTx: boolean) => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [current] }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            if (isTx) h.staged = true;
            else h.committed = true;
            return [updated];
          },
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        throw new Error("snapshot failed");
      },
    }),
  });
  const tx = makeClient(true);
  const db = {
    ...makeClient(false),
    transaction: async (cb: (client: typeof tx) => Promise<unknown>) => {
      try {
        const result = await cb(tx);
        h.committed = h.staged;
        return result;
      } catch (error) {
        h.staged = false;
        throw error;
      }
    },
  };
  return { decisions, decisionVersions, decisionEdges, getDb: () => db };
});

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2] }),
}));

import { updateDecision } from "../src/graph/service";

describe("R10-022 updateDecision atomicity", () => {
  it("does not commit the update when the snapshot insert fails", async () => {
    h.committed = false;
    h.staged = false;
    await expect(updateDecision("r1", "d1", { decision: "new" })).rejects.toThrow("snapshot failed");
    expect(h.committed).toBe(false);
  });
});
