import { describe, expect, it } from "vitest";
import { evidencePrNumbers } from "../src/pipelines/extract";

describe("evidencePrNumbers", () => {
  it("parses every cited PR number, not just the first per string", () => {
    expect(evidencePrNumbers(["PR #12, PR #999999"])).toEqual([12, 999999]);
    expect(evidencePrNumbers(["PR #12 #34"])).toEqual([12, 34]);
    expect(evidencePrNumbers(["PR #12", "PR #34, PR #56"])).toEqual([12, 34, 56]);
  });
});
