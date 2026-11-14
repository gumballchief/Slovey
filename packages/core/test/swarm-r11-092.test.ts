import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("R11-092: content-scan caps must not silently pass", () => {
  it("does not pass when a violation sits past the file cap", () => {
    const files = Array.from({ length: 200 }, (_, i) => ({
      path: `src/benign${i}.ts`,
      content: `export const benign${i} = ${i};\n`,
    }));
    files.push({ path: "src/evil.ts", content: `export const evil = "FORBIDDEN_EVIL_PATTERN";\n` });
    const changedPaths = files.map((f) => f.path);
    const result = architectureCheckContents(files, changedPaths, [
      { type: "forbidden-content", pattern: "FORBIDDEN_EVIL_PATTERN", reason: "test reason" },
    ]);
    expect(result.status).not.toBe("pass");
    expect(result.skippedReason).toBeDefined();
  });
});
