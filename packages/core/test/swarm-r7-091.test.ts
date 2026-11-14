import { describe, expect, it } from "vitest";
import { extractQueryKeywords } from "../src/pipelines/retrieve";

describe("R7-091 keyword backstop cap", () => {
  it("ignores terms past the capped query window", () => {
    const pr = {
      title: "normal title here",
      body: `${"a".repeat(5000)} uniquetailkeywordzz`,
      changedFiles: [],
      diffSummary: "",
    };
    expect(extractQueryKeywords(pr)).not.toContain("uniquetailkeywordzz");
  });

  it("keeps normal distinctive terms", () => {
    const pr = {
      title: "Add payments webhook",
      body: "stripe checkout flow",
      changedFiles: [],
      diffSummary: "",
    };
    expect(extractQueryKeywords(pr)).toContain("payments");
  });
});
