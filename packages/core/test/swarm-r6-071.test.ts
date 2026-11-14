import { describe, expect, it } from "vitest";
import { JUDGE_DIFF_LIMIT, rejectedKeywordHit, truncationNoteForDiff } from "../src/preflight/decisions";

describe("R6-071 tail truncation", () => {
  it("warns on huge diffs and still finds tail keywords via full-diff scan", () => {
    expect(JUDGE_DIFF_LIMIT).toBe(20000);
    const token = "zxqvforbiddenpackage";
    const decision = `Do not use ${token}, it was rejected for security reasons`;
    const head = "a ".repeat(15000);
    const fullDiff = `${head}\nimport ${token}\n`;
    expect(fullDiff.length).toBeGreaterThan(JUDGE_DIFF_LIMIT);
    // Tail violation is invisible in the capped head window.
    expect(rejectedKeywordHit(decision, fullDiff.slice(0, JUDGE_DIFF_LIMIT))).toBeNull();
    // Full-diff scan still catches it.
    expect(rejectedKeywordHit(decision, fullDiff)).toBe(token);
    // Caller gets a truncation warning instead of silence.
    const warning = truncationNoteForDiff(fullDiff);
    expect(warning).toContain("truncated");
    expect(truncationNoteForDiff("small diff")).toBeUndefined();
  });
});
