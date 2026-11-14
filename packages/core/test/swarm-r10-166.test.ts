import { describe, expect, it } from "vitest";
import { hasHeadChanged } from "../src/pipelines/check";

describe("stale-head guard fails closed", () => {
  it("treats an unverifiable re-fetched head as changed so the stale run is skipped", () => {
    expect(hasHeadChanged("old-sha", null)).toBe(true);
    expect(hasHeadChanged("old-sha", undefined)).toBe(true);
    expect(hasHeadChanged("old-sha", "")).toBe(true);
  });

  it("keeps normal head comparisons", () => {
    expect(hasHeadChanged("same-sha", "same-sha")).toBe(false);
    expect(hasHeadChanged("old-sha", "new-sha")).toBe(true);
  });
});
