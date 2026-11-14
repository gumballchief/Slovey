import { describe, expect, it } from "vitest";
import { scopeScore } from "../src/graph/service";

describe("R6-026 empty scope applies-everywhere", () => {
  it("gives a baseline score > 0 for decisions with no scope facets", () => {
    const empty = { services: [], domains: [], languages: [], frameworks: [], directories: [] };
    expect(scopeScore(empty, { services: ["api"] }, ["src/a.ts"])).toBeGreaterThan(0);
  });
  it("still returns 0 for scoped decisions that do not match", () => {
    const scoped = { services: ["billing"], domains: [], languages: [], frameworks: [], directories: [] };
    expect(scopeScore(scoped, { services: ["api"] }, ["src/a.ts"])).toBe(0);
  });
});
