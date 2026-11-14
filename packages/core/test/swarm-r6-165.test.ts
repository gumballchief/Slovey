import { describe, expect, it } from "vitest";
import { scopeScore } from "../src/graph/service";

describe("scopeScore directory boundary (R6-165)", () => {
  it("does not match sibling prefix src/app vs src/app2/billing.ts", () => {
    const d = { services: [], domains: [], languages: [], frameworks: [], directories: ["src/app"] };
    expect(scopeScore(d, {}, ["src/app2/billing.ts"])).toBe(0);
  });
  it("does not match sibling prefix src vs srcfoo/x.ts", () => {
    const d = { services: [], domains: [], languages: [], frameworks: [], directories: ["src"] };
    expect(scopeScore(d, {}, ["srcfoo/x.ts"])).toBe(0);
  });
  it("still matches paths inside the directory and exact match", () => {
    const d = { services: [], domains: [], languages: [], frameworks: [], directories: ["src/app"] };
    expect(scopeScore(d, {}, ["src/app/billing.ts"])).toBeGreaterThan(0);
    expect(scopeScore(d, {}, ["src/app"])).toBeGreaterThan(0);
  });
});
