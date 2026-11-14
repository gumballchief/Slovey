import { describe, expect, it } from "vitest";
import { splitDocs } from "../src/pipelines/import-docs";

describe("splitDocs DoS caps (R11-066)", () => {
  it("caps many duplicate H1 titles", () => {
    const parts: string[] = [];
    for (let i = 0; i < 120; i++) parts.push(`# \u65e5\u672c\u8a9e\ntext ${i}`);
    const docs = splitDocs(parts.join("\n"));
    expect(docs.length).toBeLessThanOrEqual(30);
    expect(new Set(docs.map((d) => d.path)).size).toBe(docs.length);
  });

  it("caps raw blob size", () => {
    const raw = `prefix\n${"a".repeat(300_000)}`;
    const docs = splitDocs(raw);
    expect(docs.length).toBe(1);
    expect(docs[0].content.length).toBeLessThanOrEqual(200_000);
  });
});
