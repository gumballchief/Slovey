import { describe, it, expect, afterEach } from "vitest";
import { setAI } from "../src/ai";
import { securityReviewCheck } from "../src/preflight/security";

afterEach(() => {
  setAI(null);
});

describe("R3-293 malformed LLM findings", () => {
  it("treats non-array findings as skipped instead of crashing", async () => {
    for (const bad of ["pwned", { issue: "x" }, 123, true]) {
      setAI({ completeJSON: async () => ({ findings: bad }) } as any);
      const r = await securityReviewCheck("some diff", ["a.ts"]);
      expect(r.status).toBe("skipped");
    }
  });
});
