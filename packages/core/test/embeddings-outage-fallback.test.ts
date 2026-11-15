import { describe, expect, it, vi } from "vitest";

// Embeddings provider is down (e.g. Gemini prepaid credit depleted -> 402).
vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => {
      throw new Error("Gemini embeddings 402: Your prepayment credits are depleted.");
    },
  }),
}));

const rows = [
  {
    id: "d-css",
    decision: "Style components with CSS modules, not styled-components",
    why: "Smaller bundles.",
    examples: [],
    evidence: ["PR #12"],
    category: "frontend",
  },
  {
    id: "d-vitest",
    decision: "Tests use Vitest, never Jest",
    why: "One runner across the monorepo; Jest config drifted twice.",
    examples: ["import { describe } from 'vitest'"],
    evidence: ["PR #418"],
    category: "testing",
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

import { retrieveDecisions } from "../src/pipelines/retrieve";
import { lexicalSimilarity, lexicalTerms } from "../src/pipelines/lexical";

describe("embeddings outage falls back to keyword search", () => {
  it("still finds the decision a diff breaks instead of throwing", async () => {
    const found = await retrieveDecisions(
      "repo-1",
      {
        title: "preflight change",
        body: "+import { describe, it } from 'jest';\n+test('adds', () => {})",
        changedFiles: ["src/math.test.ts"],
      },
      { topK: 1 },
    );
    expect(found.map((d) => d.id)).toEqual(["d-vitest"]);
    expect(found[0]!.distance).toBeLessThan(1);
  });

  it("scores short questions and long diffs both ways", () => {
    const decision = lexicalTerms("Tests use Vitest, never Jest");
    expect(lexicalSimilarity(lexicalTerms("Can I use Jest?"), decision)).toBe(1);
    expect(lexicalSimilarity(lexicalTerms("how do we deploy to production"), decision)).toBe(0);
  });
});
