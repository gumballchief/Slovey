import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "../src/pipelines/import-docs";

describe("normalizeEvidence string fallback", () => {
  it("falls back to the doc path when a comma-only string yields no evidence", () => {
    expect(normalizeEvidence(",", "docs/adr-1.md")).toEqual(["docs/adr-1.md"]);
    expect(normalizeEvidence(" , ", "docs/adr-1.md")).toEqual(["docs/adr-1.md"]);
    expect(normalizeEvidence(",,,", "docs/adr-1.md")).toEqual(["docs/adr-1.md"]);
  });

  it("still returns the parsed entries for a normal comma-separated string", () => {
    expect(normalizeEvidence("PR #1, ADR-2", "docs/adr-1.md")).toEqual(["PR #1", "ADR-2"]);
  });
});
