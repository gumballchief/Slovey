import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ insertCalls: [] as Array<Record<string, unknown>> }));

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        hoisted.insertCalls.push(v);
        return { returning: async () => [{ id: "new-id" }] };
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  };
  return { ...orig, getDb: () => fakeDb };
});

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2, 0.3] }),
}));

vi.mock("../src/graph/service", () => ({
  activeDecisionsForScope: async () => [],
  addEdge: async () => {},
}));

import { upsertDecisions } from "../src/pipelines/upsert-decisions";

describe("R6-211 blank decision text is skipped", () => {
  it("does not insert empty or whitespace decisions", async () => {
    hoisted.insertCalls.length = 0;
    const result = await upsertDecisions(
      "repo-1",
      [
        { d: { decision: "", why: "w", examples: [], evidence: ["e"] }, source: "github_pr" },
        { d: { decision: "   ", why: "w2", examples: [], evidence: ["e2"] }, source: "github_pr" },
      ],
      "extract",
    );
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(hoisted.insertCalls.length).toBe(0);
  });

  it("stores trimmed decision text", async () => {
    hoisted.insertCalls.length = 0;
    await upsertDecisions(
      "repo-1",
      [{ d: { decision: "  Use tabs  ", why: "w", examples: [], evidence: ["e"] }, source: "github_pr" }],
      "extract",
    );
    expect(hoisted.insertCalls.length).toBe(1);
    expect(hoisted.insertCalls[0]?.["decision"]).toBe("Use tabs");
  });
});
