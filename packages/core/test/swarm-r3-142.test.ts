import { describe, expect, it } from "vitest";
import { redact } from "../src/preflight/redact";

describe("redact unterminated private key", () => {
  it("removes the body when the END marker is absent", () => {
    const body1 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC";
    const body2 = "BkcwggSjAgEAAoIBAQC7actualbody123456";
    const out = redact(`before\n-----BEGIN PRIVATE KEY-----\n${body1}\n${body2}`);
    expect(out).toContain("before");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain(body1);
    expect(out).not.toContain(body2);
    expect(out).not.toContain("actualbody123456");
  });

  it("removes a truncated single-line body and preserves following prose", () => {
    const body = "MIIE...actual-base64-body";
    const out = redact(`-----BEGIN RSA PRIVATE KEY-----\n${body}\nservice restarted successfully`);
    expect(out).not.toContain("MIIE");
    expect(out).not.toContain("actual-base64-body");
    expect(out).toContain("service restarted successfully");
  });

  it("still removes a complete private key block", () => {
    const out = redact("-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\nafter");
    expect(out).toBe("[REDACTED]\nafter");
  });
});
