import { describe, expect, it } from "vitest";
import { splitDocs } from "../src/pipelines/import-docs";

describe("splitDocs fenced code blocks (R6-190)", () => {
  it("does not split on # comments inside fenced code blocks", () => {
    const raw = [
      "# ADR 1: Use postgres",
      "",
      "We chose postgres for relational data.",
      "",
      "```sh",
      "# Install dependencies",
      "npm install",
      "# Production config",
      "npm run start",
      "```",
      "",
      "More rationale here.",
    ].join("\n");
    const docs = splitDocs(raw);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.content).toContain("# Install dependencies");
    expect(docs[0]?.content).toContain("More rationale here.");
  });

  it("still splits on real H1 headings after a closed fence", () => {
    const raw = [
      "# ADR 1: Use postgres",
      "",
      "```yaml",
      "# TODO: rotate keys",
      "key: abc",
      "```",
      "",
      "# ADR 2: Use redis",
      "",
      "Cache layer.",
    ].join("\n");
    const docs = splitDocs(raw);
    expect(docs).toHaveLength(2);
  });
});
