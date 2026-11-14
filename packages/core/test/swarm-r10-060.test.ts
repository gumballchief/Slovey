import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("R10-060 large git diffs", () => {
  it("git helpers pass an explicit maxBuffer larger than the 1 MiB default", () => {
    const sourcePath = fileURLToPath(new URL("../src/preflight/detect.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");
    const values: number[] = [];
    for (const match of source.matchAll(/maxBuffer:\s*([0-9][0-9\s*]*)/g)) {
      const expression = match[1] ?? "";
      const value = expression
        .split("*")
        .map((part) => Number(part.trim()))
        .reduce((acc, n) => acc * n, 1);
      values.push(value);
    }
    // Both git() and gitZ() shell out to git and can emit large output.
    expect(values.length).toBeGreaterThanOrEqual(2);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(16 * 1024 * 1024);
    }
  });
});
