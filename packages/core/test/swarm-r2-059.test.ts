import { describe, expect, it } from "vitest";
import { guardWarning, normalizeCitation } from "../src/guardrails/citation";
import { statusForVerdict } from "../src/pipelines/check";

describe("R2-059 hostile judge JSON type-confusion", () => {
  it("does not throw on non-string evidence/explanation", () => {
    const hostile = {
      warn: true,
      confidence: "high",
      explanation: 123,
      evidence: 123,
      severity: [],
      suggestedFix: {},
    } as unknown as { warn: boolean; confidence: "high"; evidence: string; explanation: string };
    const decisions = [{ id: "d1", decision: "do not do X", evidence: ["PR #29499"] }];
    expect(() => normalizeCitation(hostile.evidence as unknown as string)).not.toThrow();
    expect(() => guardWarning(hostile as never, decisions, "high")).not.toThrow();
    expect(() => statusForVerdict("conflict", hostile.explanation as unknown as string)).not.toThrow();
  });
});
