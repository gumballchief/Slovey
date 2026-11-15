import { describe, expect, it, vi } from "vitest";

// Embeddings provider is down (e.g. Gemini prepaid credit depleted -> 402).
vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => {
      throw new Error("Gemini embeddings 402: Your prepayment credits are depleted.");
    },
  }),
}));

const base = { status: "approved", confidence: 0.9, review: "confirmed", updatedAt: new Date(), examples: [], evidence: [], title: null };
const rows = [
  { ...base, id: "d-deploy", decision: "Deploy through Render blueprints only", why: "One source of config." },
  {
    ...base,
    id: "d-vitest",
    decision: "Automated tests use Vitest. New tests should be written for Vitest, not a different test runner.",
    why: "One runner across the monorepo.",
  },
];

vi.mock("@company-brain/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@company-brain/db")>();
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return { ...actual, getDb: () => chain };
});

import { retrieveRanked } from "../src/reasoning/engine";

describe("ask/can_i keyword mode while embeddings are down", () => {
  it("passes a synonym-phrased question's best match to the reasoner instead of going silent", async () => {
    const ranked = await retrieveRanked("repo-1", "Which test framework should we use, and can I use Jest?");
    const vitest = ranked.find((r) => r.row.id === "d-vitest")!;
    // Inside both silence thresholds (ask 0.55, can_i 0.6).
    expect(vitest.distance).toBeLessThanOrEqual(0.5);
    // A decision with no shared term stays outside them.
    expect(ranked.find((r) => r.row.id === "d-deploy")!.distance).toBe(1);
  });
});
