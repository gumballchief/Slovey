import { describe, it, expect } from "vitest";
import { parseErrors } from "../src/preflight/parse";

describe("R5-002 private-key redaction", () => {
  it("redacts ENCRYPTED/DSA/PGP key blocks and 64-char base64 lines", () => {
    const body = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const blocks = [
      `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${body}\n-----END ENCRYPTED PRIVATE KEY-----`,
      `-----BEGIN DSA PRIVATE KEY-----\n${body}\n-----END DSA PRIVATE KEY-----`,
      `-----BEGIN PGP PRIVATE KEY BLOCK-----\n${body}\n-----END PGP PRIVATE KEY BLOCK-----`,
    ];
    for (const b of blocks) {
      const errs = parseErrors("build", `build failed\n${b}`);
      expect(errs.length).toBeGreaterThan(0);
      for (const e of errs) {
        expect(e.message).not.toContain("BEGIN");
        expect(e.message).not.toContain(body);
        expect(e.message).toContain("[REDACTED]");
      }
    }
    const errs2 = parseErrors("build", `build failed\n${body}`);
    expect(errs2.length).toBeGreaterThan(0);
    expect(errs2[0]!.message).not.toContain(body);
    expect(errs2[0]!.message).toContain("[REDACTED]");
  });
});
