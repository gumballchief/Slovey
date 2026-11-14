import { describe, it, expect } from "vitest";
import { judgePrompt, categorizePrompt } from "../src/ai/prompts";

describe("R6-005 prompt truncation", () => {
  it("judgePrompt bounds title/body/diffSummary", () => {
    const big = "x".repeat(20000);
    const p = judgePrompt(
      [{ decision: "d", examples: [], evidence: ["PR #1"] }],
      { title: big, body: big, diffSummary: big },
    );
    expect(p).not.toContain(big);
    expect(p.length).toBeLessThan(20000);
  });
  it("categorizePrompt bounds title/body/diffSummary", () => {
    const big = "y".repeat(20000);
    const p = categorizePrompt({ title: big, body: big, diffSummary: big });
    expect(p).not.toContain(big);
    expect(p.length).toBeLessThan(20000);
  });
});
