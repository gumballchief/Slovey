import { describe, expect, it } from "vitest";
import { parseNulSeparatedPaths } from "../src/preflight/detect";

describe("NUL-separated changed-file paths", () => {
  it("preserves newline, quote, backslash and space filenames verbatim", () => {
    const raw = "evil\nbreak.ts\0a\"b.ts\0back\\slash.ts\0 lead.ts\0trail.ts \0normal.ts\0";
    expect(parseNulSeparatedPaths(raw)).toEqual([
      "evil\nbreak.ts",
      'a"b.ts',
      "back\\slash.ts",
      " lead.ts",
      "trail.ts ",
      "normal.ts",
    ]);
  });

  it("drops only empty entries", () => {
    expect(parseNulSeparatedPaths("")).toEqual([]);
    expect(parseNulSeparatedPaths("a.ts\0\0b.ts\0")).toEqual(["a.ts", "b.ts"]);
  });
});
