import { describe, expect, it } from "vitest";
import { PROTECTED_PATH, normalizeAgentPath } from "../src/pipelines/agent";

describe("R11-055 protected-path normalization", () => {
  it("dot-segment and duplicate-slash bypasses normalize to a protected path", () => {
    const evilDot = ".github/./workflows/evil.yml";
    const evilSlash = ".github//workflows/evil.yml";
    // Raw check misses the bypass (the bug).
    expect(PROTECTED_PATH.test(evilDot)).toBe(false);
    expect(PROTECTED_PATH.test(evilSlash)).toBe(false);
    // Normalized check catches it.
    expect(PROTECTED_PATH.test(normalizeAgentPath(evilDot) as string)).toBe(true);
    expect(PROTECTED_PATH.test(normalizeAgentPath(evilSlash) as string)).toBe(true);
    expect(normalizeAgentPath(evilDot)).toBe(".github/workflows/evil.yml");
    expect(normalizeAgentPath(evilSlash)).toBe(".github/workflows/evil.yml");
  });

  it("rejects parent traversal", () => {
    expect(normalizeAgentPath("../.github/workflows/evil.yml")).toBeNull();
    expect(normalizeAgentPath(".github/workflows/../../.env")).toBeNull();
  });
});
