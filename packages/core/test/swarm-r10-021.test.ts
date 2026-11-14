import { describe, expect, it, vi } from "vitest";
import { getDb } from "@company-brain/db";
import { createDecision } from "../src/graph/service";

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => [0.1, 0.2, 0.3],
  }),
}));

vi.mock("@company-brain/db", () => {
  const decisionsTable = { __table: "decisions" };
  const decisionVersionsTable = { __table: "decisionVersions" };
  const decisionEdgesTable = { __table: "decisionEdges" };
  const committed: Record<string, unknown>[] = [];

  function makeClient(commit: (row: Record<string, unknown>) => void) {
    return {
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const isVersion = table === decisionVersionsTable;
          const exec = async (): Promise<never> => {
            throw new Error("snapshot failed");
          };
          return {
            returning: async () => {
              if (isVersion) throw new Error("snapshot failed");
              const row: Record<string, unknown> = {
                id: "dec-1",
                version: 1,
                ...values,
              };
              commit(row);
              return [row];
            },
            // snapshot() awaits values() directly (no .returning()), so the
            // returned object must be thenable and reject for versions.
            then: (
              onFulfilled: (value: never) => unknown,
              onRejected: (reason: unknown) => unknown,
            ) => exec().then(onFulfilled, onRejected),
            catch: (onRejected: (reason: unknown) => unknown) =>
              exec().catch(onRejected),
          };
        },
      }),
    };
  }

  const db = {
    ...makeClient((row) => committed.push(row)),
    __committed: committed,
    transaction: async (
      cb: (tx: ReturnType<typeof makeClient>) => Promise<unknown>,
    ) => {
      const staged: Record<string, unknown>[] = [];
      const tx = makeClient((row) => staged.push(row));
      const result = await cb(tx);
      committed.push(...staged);
      return result;
    },
  };

  return {
    decisions: decisionsTable,
    decisionVersions: decisionVersionsTable,
    decisionEdges: decisionEdgesTable,
    getDb: () => db,
  };
});

describe("R10-021 createDecision atomicity", () => {
  it("does not leave an orphan decision when the v1 snapshot fails", async () => {
    const db = getDb() as unknown as {
      __committed: Record<string, unknown>[];
    };
    await expect(
      createDecision("repo-1", {
        decision: "Use postgres",
        evidence: ["pr-1"],
        source: "github",
      }),
    ).rejects.toThrow("snapshot failed");
    expect(db.__committed).toHaveLength(0);
  });
});
