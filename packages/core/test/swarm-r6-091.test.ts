import { describe, expect, it, vi } from "vitest";

vi.mock("../src/ai", () => ({
  getAI: () => ({
    completeJSON: async () => ({
      findings: [
        null,
        "oops",
        { issue: 123, file: "src/bad.ts", confidence: 1 },
        { issue: "Real SQL injection", file: 123, confidence: 1 },
        { issue: "Missing authz", file: "src/x.ts", confidence: 1 },
      ],
    }),
  }),
}));

import { securityReviewCheck } from "../src/preflight/security";

describe("securityReviewCheck malformed AI findings", () => {
  it("drops null/non-object/non-string-issue entries and guards non-string file", async () => {
    const result = await securityReviewCheck("diff --git a/src/x.ts b/src/x.ts", ["src/x.ts"]);
    expect(result.name).toBe("security-review");
    expect(result.status).toBe("fail");
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.message)).toEqual(["Real SQL injection", "Missing authz"]);
    expect(result.errors[0]?.file).toBe("");
    expect(result.errors[1]?.file).toBe("src/x.ts");
  });
});
