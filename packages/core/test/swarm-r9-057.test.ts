import { describe, expect, it } from "vitest";
import { buildRetrievalQueryText, extractQueryKeywords } from "../src/pipelines/retrieve";

describe("R9-057 benign padding eviction", () => {
  it("keeps diff signal in embedding query despite benign prefix padding", () => {
    const title = "benignpad ".repeat(100).slice(0, 500);
    const body = "benignpad ".repeat(500).slice(0, 2000);
    const changedFiles = ["benignfile ".repeat(300).slice(0, 2000)];
    // forbidden token at offset ~3600 in diff: beyond the ~3497 chars of diff
    // that survive when title+body+files come first, within budget when diff is first.
    const diffSummary = "padword ".repeat(450) + "forbiddenzxqv " + "padword ".repeat(50);
    const q = buildRetrievalQueryText({ title, body, changedFiles, diffSummary });
    expect(q).toContain("forbiddenzxqv");
  });

  it("extracts keywords from diff tail beyond the truncated head", () => {
    const diffSummary = "padword ".repeat(1500) + " tailtokenzxqv";
    const kws = extractQueryKeywords({
      title: "benignpad",
      body: "benignpad",
      changedFiles: ["benignfile"],
      diffSummary,
    });
    expect(kws).toContain("tailtokenzxqv");
  });
});
