import { describe, expect, it } from "vitest";
import { shouldOverwriteExistingCheck } from "../src/pipelines/check";

describe("R6-035 conditional pr_checks upsert", () => {
  it("never overwrites a recorded clear/conflict result with skipped", () => {
    expect(shouldOverwriteExistingCheck("conflict", "skipped")).toBe(false);
    expect(shouldOverwriteExistingCheck("clear", "skipped")).toBe(false);
  });

  it("first terminal result wins over a concurrent result", () => {
    expect(shouldOverwriteExistingCheck("conflict", "clear")).toBe(false);
    expect(shouldOverwriteExistingCheck("clear", "conflict")).toBe(false);
  });

  it("allows a skipped row to self-heal on re-run", () => {
    expect(shouldOverwriteExistingCheck("skipped", "conflict")).toBe(true);
    expect(shouldOverwriteExistingCheck("skipped", "clear")).toBe(true);
    expect(shouldOverwriteExistingCheck("skipped", "skipped")).toBe(true);
  });
});
