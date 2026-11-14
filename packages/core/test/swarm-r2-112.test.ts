import { describe, expect, it } from "vitest";
import { redact } from "../src/preflight/redact";

describe("R2-112 private key block redaction", () => {
  it("redacts full PEM body, not just header", () => {
    const body1 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC";
    const body2 = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/==";
    const pem = `-----BEGIN PRIVATE KEY-----\n${body1}\n${body2}\n-----END PRIVATE KEY-----`;
    const out = redact(`output was:\n${pem}\nfailed`);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("BEGIN PRIVATE KEY");
    expect(out).not.toContain("END PRIVATE KEY");
    expect(out).not.toContain(body1);
    expect(out).not.toContain(body2);
  });
});
