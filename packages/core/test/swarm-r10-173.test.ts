import { describe, expect, it } from "vitest";
import { splitDocs } from "../src/pipelines/import-docs";

describe("splitDocs unicode titles", () => {
  it("does not collide on '.md' for non-ASCII headings", () => {
    const raw = "# \u65E5\u672C\u8A9E\u306E\u6C7A\u5B9A\ncontent a\n# \u6C7A\u5B9A\u4E8B\u9805\ncontent b";
    const docs = splitDocs(raw);
    expect(docs).toHaveLength(2);
    const paths = docs.map((d) => d.path);
    expect(paths).not.toContain(".md");
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths[0]).toBe("pasted-doc");
    expect(paths[1]).toBe("pasted-doc-2");
  });

  it("suffixes duplicate ascii slugs", () => {
    const raw = "# Hello\na\n# Hello\nb";
    const docs = splitDocs(raw);
    expect(docs).toHaveLength(2);
    const paths = docs.map((d) => d.path);
    expect(new Set(paths).size).toBe(2);
    expect(paths[0]).toBe("hello.md");
    expect(paths[1]).toBe("hello-2.md");
  });
});
