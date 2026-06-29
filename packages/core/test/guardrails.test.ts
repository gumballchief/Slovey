import { describe, expect, it } from "vitest";
import {
  guardWarning,
  meetsConfidence,
  normalizeCitation,
  resolveCitation,
  type CitableDecision,
} from "../src/guardrails";
import type { JudgeResult } from "../src/ai/types";

const repoADecisions: CitableDecision[] = [
  { id: "a1", decision: "No platform deploy configs", evidence: ["PR #29636"] },
  { id: "a2", decision: "Payments handled internally", evidence: ["PR #29296", "PR #10803"] },
];

function judge(p: Partial<JudgeResult>): JudgeResult {
  return { warn: true, confidence: "high", evidence: "PR #29636", explanation: "x", ...p };
}

describe("normalizeCitation", () => {
  it("strips case and punctuation; '#29499' is a substring of 'pr29499'", () => {
    expect(normalizeCitation("PR #29499")).toBe("pr29499");
    expect(normalizeCitation("pr 29499")).toBe("pr29499");
    expect(normalizeCitation("#29499")).toBe("29499");
    // resolveCitation uses substring matching, which is why bare numbers still resolve.
    expect("pr29499".includes("29499")).toBe(true);
  });
});

describe("resolveCitation (citation guardrail + isolation)", () => {
  it("resolves a real citation to its decision", () => {
    const m = resolveCitation({ evidence: "PR #29296" }, repoADecisions);
    expect(m?.id).toBe("a2");
  });

  it("resolves a bare-number citation via substring match", () => {
    expect(resolveCitation({ evidence: "#29636" }, repoADecisions)?.id).toBe("a1");
  });

  it("returns null when the citation matches no decision in scope", () => {
    // A citation from another repo's memory must not resolve against repo A's set.
    expect(resolveCitation({ evidence: "PR #99999" }, repoADecisions)).toBeNull();
  });

  it("returns null for empty evidence", () => {
    expect(resolveCitation({ evidence: "" }, repoADecisions)).toBeNull();
  });
});

describe("meetsConfidence (confidence floor)", () => {
  it("high threshold requires high confidence", () => {
    expect(meetsConfidence("high", "high")).toBe(true);
    expect(meetsConfidence("medium", "high")).toBe(false);
    expect(meetsConfidence("low", "high")).toBe(false);
  });
  it("low threshold accepts any", () => {
    expect(meetsConfidence("low", "low")).toBe(true);
    expect(meetsConfidence("medium", "low")).toBe(true);
  });
});

describe("guardWarning (the single post authority)", () => {
  it("never posts when the model does not warn", () => {
    expect(guardWarning(judge({ warn: false }), repoADecisions, "high").post).toBe(false);
  });

  it("never posts below the confidence floor", () => {
    const g = guardWarning(judge({ confidence: "low" }), repoADecisions, "high");
    expect(g.post).toBe(false);
    expect(g.reason).toBe("below-confidence-floor");
  });

  it("never posts a warning whose citation does not resolve", () => {
    const g = guardWarning(judge({ evidence: "PR #00000" }), repoADecisions, "high");
    expect(g.post).toBe(false);
    expect(g.reason).toBe("no-resolvable-citation");
  });

  it("posts a high-confidence warning with a resolvable citation", () => {
    const g = guardWarning(judge({ evidence: "PR #29636" }), repoADecisions, "high");
    expect(g.post).toBe(true);
    expect(g.matched?.id).toBe("a1");
  });
});
