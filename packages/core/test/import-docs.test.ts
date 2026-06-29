import { describe, expect, it } from "vitest";
import { normalizeEvidence, splitDocs } from "../src/pipelines/import-docs";

describe("splitDocs", () => {
  it("treats heading-less text as a single doc", () => {
    const d = splitDocs("Just a note about caching.", "notes.md");
    expect(d).toHaveLength(1);
    expect(d[0]!.path).toBe("notes.md");
  });

  it("splits on top-level # headings, one doc per section", () => {
    const raw = "# ADR 1: Use Postgres\nWe chose Postgres.\n# ADR 2: Reject Mongo\nMongo was rejected.";
    const d = splitDocs(raw);
    expect(d).toHaveLength(2);
    expect(d[0]!.path).toBe("adr-1-use-postgres.md");
    expect(d[0]!.content).toContain("We chose Postgres");
    expect(d[1]!.path).toBe("adr-2-reject-mongo.md");
  });

  it("ignores ## subheadings when splitting", () => {
    const raw = "# Architecture\nIntro.\n## Section\nDetail.";
    expect(splitDocs(raw)).toHaveLength(1);
  });

  it("returns nothing for empty input", () => {
    expect(splitDocs("")).toEqual([]);
    expect(splitDocs("   \n  ")).toEqual([]);
  });
});

describe("normalizeEvidence", () => {
  it("keeps array evidence, falling back to the path when empty", () => {
    expect(normalizeEvidence(["PR #1", "PR #1"], "x.md")).toEqual(["PR #1"]);
    expect(normalizeEvidence([], "x.md")).toEqual(["x.md"]);
  });
  it("splits comma strings and falls back otherwise", () => {
    expect(normalizeEvidence("a, b", "x.md")).toEqual(["a", "b"]);
    expect(normalizeEvidence(null, "x.md")).toEqual(["x.md"]);
  });
});
