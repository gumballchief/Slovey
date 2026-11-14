import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("swarm-r3-110 ReDoS via architecture pattern", () => {
  it("does not hang on a nested-quantifier pattern over a long non-matching line", () => {
    const result = architectureCheckContents(
      [{ path: "src/a.ts", content: "x".repeat(50) }],
      ["src/a.ts"],
      [{ type: "forbidden-content", pattern: "(x+x+)+y", flags: "i", reason: "evil" } as never],
    );
    // Evil rule is disabled rather than executed, so nothing is flagged.
    expect(result.status).toBe("pass");
    expect(result.errors).toHaveLength(0);
  });

  it("does not hang on a quantified alternation pattern", () => {
    const result = architectureCheckContents(
      [{ path: "src/a.ts", content: "a".repeat(50) + "b" }],
      ["src/a.ts"],
      [{ type: "forbidden-content", pattern: "(a|aa)+$", flags: "i", reason: "evil" } as never],
    );
    expect(result.status).toBe("pass");
    expect(result.errors).toHaveLength(0);
  });

  it("still flags a legitimate forbidden pattern", () => {
    const result = architectureCheckContents(
      [{ path: "src/a.ts", content: "const x = forbiddenFn();" }],
      ["src/a.ts"],
      [{ type: "forbidden-content", pattern: "\\bforbiddenFn\\b", flags: "i", reason: "banned" } as never],
    );
    expect(result.status).toBe("fail");
    expect(result.errors).toHaveLength(1);
  });
});
