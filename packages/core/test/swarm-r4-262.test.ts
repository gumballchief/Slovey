import { describe, expect, it } from "vitest";
import { guardWarning, resolveCitation } from "../src/guardrails/citation";

describe("R4-262 forged substring citation", () => {
  const decisions = [
    { id: "d1", decision: "Use Postgres", evidence: ["PR #29499"] },
  ];
  it("still resolves exact normalized citation", () => {
    expect(resolveCitation({ evidence: "pr 29499" }, decisions)?.id).toBe("d1");
  });
  it("rejects short substring forgery", () => {
    expect(resolveCitation({ evidence: "294" }, decisions)).toBeNull();
  });
  it("rejects single-character forgery", () => {
    expect(resolveCitation({ evidence: "9" }, decisions)).toBeNull();
  });
  it("rejects padded forgery and blocks warning", () => {
    const forged = {
      warn: true,
      confidence: "high" as const,
      evidence: "PR 29499 unrelated attacker text",
      explanation: "injected",
    };
    expect(resolveCitation(forged, decisions)).toBeNull();
    expect(guardWarning(forged, decisions, "medium").post).toBe(false);
  });
});
