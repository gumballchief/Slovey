import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    setPayload: Record<string, unknown> | null;
    near: Record<string, unknown> | null;
  } = { setPayload: null, near: null };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [state.near],
          }),
        }),
      }),
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        state.setPayload = payload;
        return { where: async () => undefined };
      },
    }),
  };
  return { state, db };
});

vi.mock("@company-brain/db", () => ({
  decisions: {
    id: "id",
    evidence: "evidence",
    examples: "examples",
    review: "review",
    source: "source",
    embedding: "embedding",
    repoId: "repoId",
    domains: "domains",
    services: "services",
    languages: "languages",
    frameworks: "frameworks",
  },
  getDb: () => h.db,
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...args: unknown[]) => ({ args }),
  sql: (_strings: TemplateStringsArray, ..._vals: unknown[]) => ({}),
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2] }),
}));

vi.mock("../src/graph/service", () => ({
  activeDecisionsForScope: async () => [],
  addEdge: async () => undefined,
}));

import { upsertDecisions } from "../src/pipelines/upsert-decisions";

describe("R11-076 partial scope on dedup update", () => {
  beforeEach(() => {
    h.state.setPayload = null;
    h.state.near = {
      id: "d1",
      evidence: ["PR #1"],
      examples: [],
      review: "unreviewed",
      source: "github_pr",
      distance: 0.01,
      domains: ["billing"],
      services: ["PaymentService"],
      languages: ["python"],
      frameworks: ["react"],
    };
  });

  it("preserves absent scope fields while replacing present ones", async () => {
    await upsertDecisions("repo1", [
      {
        d: {
          decision: "Always use typescript",
          why: "consistency",
          examples: [],
          evidence: ["PR #2"],
        },
        source: "github_pr",
      },
    ]);
    const payload = h.state.setPayload;
    expect(payload).not.toBeNull();
    // Present field is recomputed (stale python is replaced, not unioned).
    expect(payload?.languages).toEqual(["typescript"]);
    // Absent fields must not be wiped to [].
    expect(payload?.domains).toEqual(["billing"]);
    expect(payload?.services).toEqual(["PaymentService"]);
    expect(payload?.frameworks).toEqual(["react"]);
  });
});
