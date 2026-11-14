import { describe, expect, it, vi } from "vitest";
import { extractScope } from "../src/planning/classify";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

const mockState = vi.hoisted(() => ({
  capturedSet: null as Record<string, unknown> | null,
  nearRow: {
    id: "near-id",
    evidence: ["old-evidence"],
    examples: ["old-example"],
    review: "unreviewed",
    source: "github_pr",
    distance: 0.05,
  },
}));

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [mockState.nearRow],
          }),
        }),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        mockState.capturedSet = vals;
        return { where: async () => undefined };
      },
    }),
    insert: () => {
      throw new Error("should not insert");
    },
  }),
  decisions: {
    id: "id",
    evidence: "evidence",
    examples: "examples",
    review: "review",
    source: "source",
    repoId: "repoId",
    embedding: "embedding",
  },
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => [0.1, 0.2, 0.3],
  }),
}));

vi.mock("../src/graph/service", () => ({
  activeDecisionsForScope: async () => [],
  addEdge: async () => undefined,
}));

describe("R6-208 stale scope on merge", () => {
  it("recomputes scope when merging into an unlocked decision", async () => {
    mockState.capturedSet = null;
    const d = {
      decision: "Use redis for billing cache",
      why: "billing needs fast redis cache",
      examples: [] as string[],
      evidence: ["pr-1"],
    };
    await upsertDecisions("repo-1", [{ d, source: "github_pr" }]);
    const expected = extractScope([d.decision, d.why, ""].join("\n"));
    expect(mockState.capturedSet).not.toBeNull();
    const updated = mockState.capturedSet as Record<string, unknown>;
    expect(updated["domains"]).toEqual(expected.domains ?? []);
    expect(updated["frameworks"]).toEqual(expected.frameworks ?? []);
    expect(updated["languages"]).toEqual(expected.languages ?? []);
    expect(updated["services"]).toEqual(expected.services ?? []);
  });
});
