import { describe, it, expect } from "vitest";
import { extractPrompt } from "../src/ai/prompts";

describe("extractPrompt batch cap (R10-003)", () => {
  it("truncates unbounded batch text so the prompt stays bounded", () => {
    const big = "x".repeat(200000);
    const prompt = extractPrompt(big);
    // Unbounded interpolation would make the prompt ~200k chars; capped at 40k + template overhead.
    expect(prompt.length).toBeLessThan(50000);
  });
  it("keeps a full 8-PR batch (about 32k chars) intact", () => {
    const batch = "y".repeat(32000) + "END_MARKER";
    expect(extractPrompt(batch)).toContain("END_MARKER");
  });
  it("keeps small batches intact", () => {
    expect(extractPrompt("short batch")).toContain("short batch");
  });
});
