import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("R9-067 architecture content-match cap", () => {
  it("caps errors per rule per file and keeps line numbers correct", () => {
    const count = 2000;
    const content = Array.from({ length: count }, () => "a").join("\n");
    const result = architectureCheckContents(
      [{ path: "src/app.ts", content }],
      ["src/app.ts"],
      [{ type: "forbidden-content", pattern: "a", reason: "no a" }],
    );
    expect(result.status).toBe("fail");
    expect(result.errors.length).toBeLessThanOrEqual(100);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.line).toBe(1);
    expect(result.errors[1]?.line).toBe(2);
  });
});
