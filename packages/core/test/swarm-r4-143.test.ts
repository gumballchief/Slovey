import { describe, it, expect } from "vitest";
import { redact } from "../src/preflight/redact";

describe("R4-143 truncated encrypted key with PEM headers", () => {
  it("redacts headers and truncated body, not just BEGIN line", () => {
    const input =
      "-----BEGIN ENCRYPTED PRIVATE KEY-----\n" +
      "Proc-Type: 4,ENCRYPTED\n" +
      "DEK-Info: AES-256-CBC,0123456789ABCDEF\n" +
      "\n" +
      "MIIBvTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQ";
    const out = redact(input);
    expect(out).toBe("[REDACTED]");
    expect(out).not.toContain("Proc-Type");
    expect(out).not.toContain("DEK-Info");
    expect(out).not.toContain("MIIBvTBX");
  });
});
