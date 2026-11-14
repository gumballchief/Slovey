import { describe, it, expect } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";
import type { ArchitectureRule } from "../src/preflight/types";

const rules: ArchitectureRule[] = [
  { type: "forbidden-content", pattern: "badtoken123", flags: "i", reason: "test rule" },
];

describe("architectureCheckContents size/binary cap (R10-207)", () => {
  it("skips files larger than 512_000 bytes", () => {
    const big = `${"hello world\n".repeat(50000)}badtoken123\n`;
    expect(big.length > 512_000).toBe(true);
    const r = architectureCheckContents([{ path: "src/app.ts", content: big }], ["src/app.ts"], rules);
    expect(r.status).toBe("pass");
    expect(r.errors).toEqual([]);
  });

  it("skips files containing NUL", () => {
    const content = "badtoken123 \u0000 hello";
    const r = architectureCheckContents([{ path: "src/app.ts", content }], ["src/app.ts"], rules);
    expect(r.status).toBe("pass");
    expect(r.errors).toEqual([]);
  });

  it("still flags a small file with the pattern", () => {
    const r = architectureCheckContents(
      [{ path: "src/app.ts", content: "const x = 1;\n// badtoken123\n" }],
      ["src/app.ts"],
      rules,
    );
    expect(r.status).toBe("fail");
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
