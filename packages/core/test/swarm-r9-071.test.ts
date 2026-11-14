import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("R9-071 nested-group ReDoS guard", () => {
  it("disables nested evil quantifiers that hide alternation/inner-quantifier in an inner group", () => {
    const cases = [
      { pattern: "((a|aa))+b", content: "aaab" },
      { pattern: "((a+))+$", content: "aaa" },
      { pattern: "(([a-z]+))+b", content: "aaab" },
    ];
    for (const c of cases) {
      const r = architectureCheckContents(
        [{ path: "src/a.ts", content: c.content }],
        ["src/a.ts"],
        [{ type: "forbidden-content", pattern: c.pattern, reason: "evil" }],
      );
      expect(r.status).toBe("pass");
      expect(r.errors).toHaveLength(0);
    }
  });

  it("keeps safe quantified groups working", () => {
    const r = architectureCheckContents(
      [{ path: "src/a.ts", content: "foofoo" }],
      ["src/a.ts"],
      [{ type: "forbidden-content", pattern: "(foo)+", reason: "safe" }],
    );
    expect(r.status).toBe("fail");
    expect(r.errors).toHaveLength(1);
  });
});
