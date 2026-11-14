import { describe, it, expect } from "vitest";
import { redact } from "../src/preflight/redact";

describe("R4-144 PGP private key block redaction", () => {
  it("redacts a full PGP armor private key block with headers and blank line", () => {
    const base64 = "mQENBFakeBase64PayloadLineForTestingOnly1234567890abcdef";
    const input = [
      "before",
      "-----BEGIN PGP PRIVATE KEY BLOCK-----",
      "Version: GnuPG v2",
      "Comment: test header",
      "",
      base64,
      "=abcd",
      "-----END PGP PRIVATE KEY BLOCK-----",
      "after",
    ].join("\n");
    const out = redact(input);
    expect(out).toContain("before");
    expect(out).toContain("after");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("PGP PRIVATE KEY");
    expect(out).not.toContain(base64);
    expect(out).not.toContain("Version: GnuPG");
  });
});
