import { describe, expect, it } from "vitest";
import { redact } from "../src/preflight/redact";

describe("R3-141 encrypted private key redaction", () => {
  it("redacts full ENCRYPTED PRIVATE KEY block", () => {
    const input = "output:\n-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIEabc123XYZ\n-----END ENCRYPTED PRIVATE KEY-----\ndone";
    const out = redact(input);
    expect(out).not.toContain("MIIEabc123XYZ");
    expect(out).toContain("[REDACTED]");
  });
});
