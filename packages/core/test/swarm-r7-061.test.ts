import { describe, expect, it } from "vitest";
import { shouldSkipPostForExistingVerdict } from "../src/pipelines/check";

describe("R7-061 concurrent winner suppresses loser GitHub post", () => {
  it("suppresses post when a terminal clear/conflict row already won", () => {
    expect(shouldSkipPostForExistingVerdict("conflict")).toBe(true);
    expect(shouldSkipPostForExistingVerdict("clear")).toBe(true);
  });
  it("does not suppress when no row or only transient skipped row exists", () => {
    expect(shouldSkipPostForExistingVerdict("skipped")).toBe(false);
    expect(shouldSkipPostForExistingVerdict(null)).toBe(false);
    expect(shouldSkipPostForExistingVerdict(undefined)).toBe(false);
  });
});
