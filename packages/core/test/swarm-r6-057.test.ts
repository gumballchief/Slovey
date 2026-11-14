import { describe, expect, it } from "vitest";
import { buildRetrievalQueryText, RETRIEVAL_QUERY_MAX_CHARS } from "../src/pipelines/retrieve";

describe("R6-057 retrieval query truncation", () => {
  it("caps a huge diffSummary/body to the provider limit", () => {
    const q = buildRetrievalQueryText({
      title: "mass rename",
      body: "b".repeat(100_000),
      changedFiles: ["f".repeat(50_000)],
      diffSummary: "a".repeat(200_000),
    });
    expect(q.length).toBeLessThanOrEqual(RETRIEVAL_QUERY_MAX_CHARS);
    expect(q.length).toBeLessThanOrEqual(8000);
    expect(q).toContain("mass rename");
  });

  it("applies per-field caps so diff cannot evict title/body", () => {
    const q = buildRetrievalQueryText({
      title: "fix login",
      body: "x".repeat(10_000),
      changedFiles: [],
      diffSummary: "y".repeat(100_000),
    });
    expect(q).toContain("fix login");
    expect(q.length).toBeLessThanOrEqual(8000);
  });
});
