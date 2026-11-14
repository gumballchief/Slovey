import { describe, expect, it } from "vitest";
import { guardWarning, normalizeCitation, resolveCitation } from "../src/guardrails/citation";

const decisions = [{ id: "d1", decision: "Use Postgres", evidence: ["PR #29499"] }];

describe("R2-199 non-string judge evidence", () => {
  it("normalizeCitation returns '' for non-strings instead of throwing or coercing", () => {
    expect(normalizeCitation(12345 as unknown as string)).toBe("");
    expect(normalizeCitation({ id: 1 } as unknown as string)).toBe("");
    expect(normalizeCitation(null as unknown as string)).toBe("");
    expect(normalizeCitation(undefined as unknown as string)).toBe("");
    expect(normalizeCitation("PR #29499")).toBe("pr29499");
  });

  it("resolveCitation returns null for numeric/object evidence without throwing", () => {
    expect(() => resolveCitation({ evidence: 29499 as unknown as string }, decisions)).not.toThrow();
    expect(resolveCitation({ evidence: 29499 as unknown as string }, decisions)).toBeNull();
    expect(resolveCitation({ evidence: { id: 1 } as unknown as string }, decisions)).toBeNull();
    expect(resolveCitation({ evidence: "PR #29499" }, decisions)?.id).toBe("d1");
  });

  it("guardWarning does not throw or post on non-string evidence", () => {
    const result = { warn: true, confidence: "high", evidence: 12345, explanation: "x" } as never;
    let decision: ReturnType<typeof guardWarning> | undefined;
    expect(() => { decision = guardWarning(result, decisions, "medium" as never); }).not.toThrow();
    expect(decision?.post).toBe(false);
    expect(decision?.reason).toBe("no-resolvable-citation");
  });
});
