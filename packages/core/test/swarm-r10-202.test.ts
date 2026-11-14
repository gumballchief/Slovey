import { describe, it, expect, vi } from "vitest";

vi.mock("../src/reasoning/context", () => ({
  contextForScope: vi.fn(async () => null),
}));
vi.mock("../src/api/can-i", () => ({
  canI: vi.fn(async () => ({
    verdict: "allowed",
    rationale: "ok",
    citations: [],
    rejectedPrecedent: [],
  })),
}));
vi.mock("../src/api/rejected", () => ({
  getRejectedKnowledge: vi.fn(async () => []),
}));

import { setAI } from "../src/ai";
import type { AIProvider } from "../src/ai";
import { plan } from "../src/planning/engine";

describe("R10-202: empty filtered LLM steps must fall back", () => {
  it("returns deterministic fallback steps when every LLM step lacks title/detail", async () => {
    const fake = {
      completeJSON: async () => ({
        summary: "A summary from the LLM.",
        steps: [{}, { title: "x" }],
        confidence: "high",
      }),
    } as unknown as AIProvider;
    setAI(fake);
    try {
      const result = await plan("repo-1", "Add a new billing feature");
      expect(result.steps.length).toBeGreaterThan(0);
      for (const s of result.steps) {
        expect(s.title).toBeTruthy();
        expect(s.detail).toBeTruthy();
      }
      expect(result.reasoning.join(" ")).toContain("deterministic fallback");
    } finally {
      setAI(null);
    }
  });
});
