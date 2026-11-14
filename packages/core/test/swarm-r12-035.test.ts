import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  reinforce: vi.fn(async () => null),
  completeJSON: vi.fn(async () => ({ answer: "Use [1] and [2].", used: [1, 1, 2], confidence: "high" })),
}));

const rows = [
  { row: { id: "d1", title: "One", decision: "Use Postgres", status: "approved", evidence: ["e1"], review: "confirmed" }, distance: 0.1 },
  { row: { id: "d2", title: "Two", decision: "Use Redis", status: "approved", evidence: ["e2"], review: "confirmed" }, distance: 0.2 },
];

vi.mock("@company-brain/db", () => ({
  decisions: { repoId: "repoId", status: "status", review: "review", embedding: "embedding", id: "id" },
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }) }),
  }),
}));
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}), inArray: () => ({}), sql: () => ({}) }));
vi.mock("../src/ai", () => ({ getAI: () => ({ completeJSON: hoisted.completeJSON }) }));
vi.mock("../src/embeddings", () => ({ getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2] }) }));
vi.mock("../src/graph/service", () => ({ freshnessScore: () => 0.5 }));
vi.mock("../src/memory/reinforce", () => ({ reinforce: hoisted.reinforce }));

import { reason } from "../src/reasoning/engine";

describe("reason() dedupes used indices (L35)", () => {
  it("does not return duplicate citations or reinforce twice for same decision", async () => {
    const res = await reason("repo1", "What DB?");
    expect(res.citations.map((c) => c.decisionId)).toEqual(["d1", "d2"]);
    expect(new Set(res.citations.map((c) => c.decisionId)).size).toBe(res.citations.length);
    expect(hoisted.reinforce.mock.calls.length).toBe(2);
  });
});
