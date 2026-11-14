import { describe, expect, it } from "vitest";
import { filterExtractedDecisionsToBatch } from "../src/ai/prompts";
import { evidencePrNumbers } from "../src/pipelines/extract";
import type { ExtractedDecision } from "../src/ai/types";

describe("R6-039 consolidation citation filter", () => {
  it("parses numeric PR numbers from evidence strings", () => {
    expect(evidencePrNumbers(["PR #101", "PR #102"])).toEqual([101, 102]);
  });

  it("keeps consolidated decisions citing grounded PRs", () => {
    const grounded: ExtractedDecision[] = [
      { decision: "Use pagination", why: "perf", examples: [], evidence: ["PR #101", "PR #102"] },
      { decision: "Retry with backoff", why: "flakes", examples: [], evidence: ["PR #103"] },
    ];
    const cleaned: ExtractedDecision[] = [
      { decision: "Use pagination", why: "perf", examples: [], evidence: ["PR #101"] },
    ];
    const groundedIds = grounded.flatMap((d) => evidencePrNumbers(d.evidence));
    const kept = filterExtractedDecisionsToBatch(cleaned, groundedIds);
    expect(kept.length).toBe(1);
  });
});
