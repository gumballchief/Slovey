import { describe, expect, it } from "vitest";
import { sanitizePlanningText } from "../src/planning/engine";

describe("sanitizePlanningText quadratic-DoS guard (R4-094)", () => {
  it("strips simple fence/tag sequences", () => {
    expect(sanitizePlanningText("hello ``` <system>world"))
      .not.toContain("<system>");
    expect(sanitizePlanningText("hello ``` <system>world"))
      .not.toContain("```");
  });

  it("removes one level of nesting", () => {
    expect(sanitizePlanningText("<sy<system>stem>")).toBe("");
  });

  it("truncates untrusted text before cleaning to bound CPU", () => {
    const big = "A".repeat(5000);
    expect(sanitizePlanningText(big).length).toBeLessThanOrEqual(2000);
  });

  it("handles deeply nested attack input quickly with bounded output", () => {
    const depth = 5000;
    const attack = "<sy".repeat(depth) + "<system>" + "stem>".repeat(depth);
    const start = Date.now();
    const out = sanitizePlanningText(attack);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(out.length).toBeLessThanOrEqual(2000);
  });
});
