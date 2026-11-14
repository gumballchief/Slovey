import { describe, it, expect, afterEach } from "vitest";
import { setAI } from "../src/ai";
import type { AIProvider } from "../src/ai";
import { securityReviewCheck } from "../src/preflight/security";

afterEach(() => {
  setAI(null);
});

describe("security-review diff truncation (R10-073)", () => {
  it("bounds the prompt for a very large diff", async () => {
    let captured = "";
    const fake = {
      completeJSON: async (prompt: string) => {
        captured = String(prompt);
        return { findings: [] };
      },
    } as unknown as AIProvider;
    setAI(fake);
    const big = "diff --git a/big.txt b/big.txt\n" + "x".repeat(100000);
    await securityReviewCheck(big, ["big.txt"]);
    expect(captured).toContain("truncat");
    expect(captured.length).toBeLessThan(30000);
  });
});
