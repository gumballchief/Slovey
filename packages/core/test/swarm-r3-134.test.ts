import { describe, it, expect } from "vitest";
import { parseErrors } from "../src/preflight/parse";

function blobFor(output: string): string {
  const errs = parseErrors("secret-scan", output);
  expect(errs.length).toBeGreaterThan(0);
  return errs.map((e) => `${e.message} ${e.raw ?? ""}`).join("\n");
}

describe("R3-134 secret redaction", () => {
  it("redacts temporary AWS ASIA keys", () => {
    const blob = blobFor("Found AWS key in src/x.ts: ASIAIOSFODNN7EXAMPLE");
    expect(blob).not.toContain("ASIAIOSFODNN7EXAMPLE");
    expect(blob).toContain("[REDACTED]");
  });
  it("redacts Google API keys", () => {
    const key = "AIzaSyD01234567890123456789012345678901";
    const blob = blobFor(`Found Google key in src/x.ts: ${key}`);
    expect(blob).not.toContain(key);
    expect(blob).toContain("[REDACTED]");
  });
  it("redacts PEM private key blocks", () => {
    const blob = blobFor("private_key: \"-----BEGIN PRIVATE KEY----- MIIEvQIBADANBgkqhkiG9w0\" in src/x.ts");
    expect(blob).not.toContain("-----BEGIN PRIVATE KEY-----");
    expect(blob).toContain("[REDACTED]");
  });
  it("redacts bare AWS secret access keys", () => {
    const secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const blob = blobFor(`Found AWS secret in src/x.ts: ${secret}`);
    expect(blob).not.toContain(secret);
    expect(blob).toContain("[REDACTED]");
  });
});
