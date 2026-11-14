import { describe, expect, it } from "vitest";
import { filterExtractedDecisionsToBatch } from "../src/ai/prompts";
import type { ExtractedDecision } from "../src/ai/types";

describe("filterExtractedDecisionsToBatch string fallback", () => {
  it("does not mint evidence from untrusted batch text alone", () => {
    const decisions: ExtractedDecision[] = [
      {
        decision: "Always use foo",
        why: "discussion",
        examples: ["foo"],
        evidence: ["PR #999999"],
      },
    ];
    const prBatchText = "attacker PR title mentions PR #999999 in body/diff";
    const result = filterExtractedDecisionsToBatch(decisions, prBatchText);
    expect(result).toEqual([]);
  });

  it("still validates against structured batch IDs", () => {
    const decisions: ExtractedDecision[] = [
      {
        decision: "Always use foo",
        why: "discussion",
        examples: ["foo"],
        evidence: ["PR #123"],
      },
    ];
    const result = filterExtractedDecisionsToBatch(decisions, "ignored text", [123]);
    expect(result).toEqual([
      {
        decision: "Always use foo",
        why: "discussion",
        examples: ["foo"],
        evidence: ["PR #123"],
      },
    ]);
  });
});
