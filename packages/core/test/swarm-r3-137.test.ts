import { describe, expect, it } from "vitest";
import { parseErrors, toFixInstructions } from "../src/preflight/parse";

describe("R3-137 secret redaction", () => {
  it("redacts Basic auth credential", () => {
    const out = "check failed\nAuthorization: Basic dXNlcjpwYXNzd29yZA==";
    const [e] = parseErrors("test", out);
    expect(e!.message).not.toContain("dXNlcjpwYXNzd29yZA==");
    expect(e!.message).toContain("Basic [REDACTED]");
    expect(e!.raw ?? "").not.toContain("dXNlcjpwYXNzd29yZA==");
    const [fix] = toFixInstructions("test", [e!]);
    expect(fix!.problem).not.toContain("dXNlcjpwYXNzd29yZA==");
    expect(fix!.instructionForAgent).toContain("Basic [REDACTED]");
  });

  it("redacts private key blocks", () => {
    const key = "MIIEvSECRETKEYMATERIAL1234567890abcdef";
    const out = `check failed\n-----BEGIN RSA PRIVATE KEY----- ${key} -----END RSA PRIVATE KEY-----`;
    const [e] = parseErrors("test", out);
    expect(e!.message).not.toContain(key);
    expect(e!.message).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(e!.message).toContain("[REDACTED]");
    expect(e!.raw ?? "").not.toContain(key);
  });
});
