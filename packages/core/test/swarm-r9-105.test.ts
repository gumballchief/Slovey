import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../src/preflight/redact";

const REAL_GHP = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";
const REAL_AKIA = "AKIA1234567890ABCDEF";

describe("R9-105 template files still scan provider keys", () => {
  it("flags a real GitHub token in an .example file", () => {
    const errs = scanForSecrets([{ path: "app.example.ts", content: `token = "${REAL_GHP}"` }]);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]?.code).toBe("secret");
  });
  it("flags a real AWS key in a .sample file", () => {
    const errs = scanForSecrets([{ path: "config.sample.js", content: `key = "${REAL_AKIA}"` }]);
    expect(errs.length).toBeGreaterThan(0);
  });
  it("still allows placeholder provider keys in template files", () => {
    const errs = scanForSecrets([{ path: "app.example.ts", content: `token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` }]);
    expect(errs).toHaveLength(0);
  });
  it("still skips heuristic shapes in template files", () => {
    const errs = scanForSecrets([{ path: "secrets.template.json", content: `{ "password": "your-password-here" }` }]);
    expect(errs).toHaveLength(0);
  });
});
