import { describe, it, expect } from "vitest";
import { parseErrors } from "../src/preflight/parse";

describe("R10-065 stylish bare relative path", () => {
  it("parses bare relative stylish file header", () => {
    const output = "src/foo.ts\n  3:1  error  'x' is not defined  no-undef";
    const errors = parseErrors("lint", output);
    expect(errors.length).toBe(1);
    expect(errors[0]!.file).toBe("src/foo.ts");
    expect(errors[0]!.line).toBe(3);
    expect(errors[0]!.column).toBe(1);
    expect(errors[0]!.code).toBe("no-undef");
  });
});
