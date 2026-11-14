import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/reasoning/context", () => ({ contextForScope: vi.fn() }));
vi.mock("../src/api/can-i", () => ({ canI: vi.fn() }));
vi.mock("../src/api/rejected", () => ({ getRejectedKnowledge: vi.fn() }));
vi.mock("../src/ai", () => ({ getAI: vi.fn() }));

import { plan } from "../src/planning/engine";
import { getAI } from "../src/ai";
import { canI } from "../src/api/can-i";
import { getRejectedKnowledge } from "../src/api/rejected";
import { contextForScope } from "../src/reasoning/context";

describe("R6-061: LLM synthesis failure uses deterministic fallback", () => {
  beforeEach(() => {
    vi.mocked(contextForScope).mockReset();
    vi.mocked(canI).mockReset();
    vi.mocked(getRejectedKnowledge).mockReset();
    vi.mocked(getAI).mockReset();
    vi.mocked(contextForScope).mockResolvedValue({ scope: {}, constraints: [], promptBlock: "none" });
    vi.mocked(canI).mockResolvedValue({
      intent: "add redis caching for billing",
      verdict: "unclear",
      rationale: "No recorded decision addresses this.",
      citations: [],
      rejectedPrecedent: [],
    });
    vi.mocked(getRejectedKnowledge).mockResolvedValue([]);
  });

  it("does not throw when the AI provider throws", async () => {
    vi.mocked(getAI).mockImplementation(() => {
      throw new Error("provider down");
    });
    const result = await plan("repo-1", "Add redis caching for billing");
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.reasoning.join(" ")).toContain("LLM unavailable; used deterministic fallback plan.");
  });
});
