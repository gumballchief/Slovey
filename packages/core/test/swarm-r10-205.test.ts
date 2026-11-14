import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";
import type { ArchitectureRule } from "../src/preflight/types";

describe("architectureCheckContents global caps", () => {
  it("caps total errors across many rules and files", () => {
    const rules: ArchitectureRule[] = Array.from({ length: 20 }, (_, i) => ({
      type: "forbidden-content",
      pattern: "bad",
      reason: `rule ${i}`,
    }));
    const files = Array.from({ length: 30 }, (_, i) => ({
      path: `src/f${i}.ts`,
      content: "bad\n".repeat(120),
    }));
    const result = architectureCheckContents(files, files.map((f) => f.path), rules);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeLessThanOrEqual(500);
    expect(result.status).toBe("fail");
  });

  it("caps total errors from forbidden-path rules", () => {
    const rules: ArchitectureRule[] = Array.from({ length: 50 }, (_, i) => ({
      type: "forbidden-path",
      glob: "src/**",
      reason: `rule ${i}`,
    }));
    const changed = Array.from({ length: 100 }, (_, i) => `src/f${i}.ts`);
    const result = architectureCheckContents([], changed, rules);
    expect(result.errors.length).toBeLessThanOrEqual(500);
  });

  it("does not scan files beyond the file-count limit", () => {
    const rules: ArchitectureRule[] = [{ type: "forbidden-content", pattern: "bad", reason: "no bad" }];
    const files = Array.from({ length: 250 }, (_, i) => ({
      path: `src/f${i}.ts`,
      content: i === 249 ? "bad\n" : "ok\n",
    }));
    const result = architectureCheckContents(files, files.map((f) => f.path), rules);
    expect(result.errors).toHaveLength(0);
  });
});
