import { describe, it, expect, afterEach } from "vitest";
import { setAI, type AIProvider } from "../src/ai";
import { securityReviewCheck } from "../src/preflight/security";

afterEach(() => {
  setAI(null);
});

describe("R5-121 security-review secret redaction", () => {
  it("redacts LLM-echoed secrets before persistence", async () => {
    const token = "ghp_abcdefghijklmnopqrstuvw1234567890";
    const fake = {
      completeJSON: async () => ({
        findings: [
          { file: "src/app.ts", line: 1, issue: `Hardcoded token ${token} allows takeover`, severity: "high", confidence: 0.9 },
        ],
      }),
    } as AIProvider;
    setAI(fake);
    const result = await securityReviewCheck("+ const t = 'x'", ["src/app.ts"]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.message).not.toContain(token);
    expect(result.errors[0]?.message).toContain("[REDACTED]");
  });
});
