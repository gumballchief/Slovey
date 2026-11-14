import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@company-brain/db")>();
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
      values: () => ({
        returning: async () => [{ id: "new-id" }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  };
  return { ...mod, getDb: () => fakeDb };
});

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => [0.1, 0.2, 0.3],
  }),
}));

vi.mock("../src/graph/service", () => ({
  activeDecisionsForScope: async () => [],
  addEdge: async () => undefined,
}));

vi.mock("../src/planning/classify", () => ({
  extractScope: () => ({}),
}));

describe("R4-297 malformed LLM extraction", () => {
  it("skips items with missing decision/evidence instead of crashing", async () => {
    const { upsertDecisions } = await import("../src/pipelines/upsert-decisions");
    const rawJson = `[{"d":{"decision":null,"why":"x","examples":[],"evidence":null},"source":"github_pr"},{"d":{"decision":"Use postgres","why":"reliable","examples":[],"evidence":["pr-1"]},"source":"github_pr"},{"d":{"why":"y","examples":[],"evidence":["pr-2"]},"source":"github_pr"},{"d":{"decision":"Use postgres","why":"again","examples":null,"evidence":null},"source":"github_pr"}]`;
    const items = JSON.parse(rawJson);
    const result = await upsertDecisions("repo-1", items);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
  });
});
