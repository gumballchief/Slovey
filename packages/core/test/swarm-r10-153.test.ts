import { describe, expect, it } from "vitest";
import { scopeScore } from "../src/graph/service";

const base = { services: [], domains: [], languages: [], frameworks: [] };

describe("scopeScore directory scope R10-153", () => {
  it("treats '.' as repo root matching any path", () => {
    expect(scopeScore({ ...base, directories: ["."] }, {}, ["src/app.ts"])).toBeGreaterThan(0);
  });
  it("treats '/' as repo root matching any path", () => {
    expect(scopeScore({ ...base, directories: ["/"] }, {}, ["src/app.ts"])).toBeGreaterThan(0);
  });
  it("matches NFC directory against NFD changed path", () => {
    const nfcDir = "docs/caf\u00e9";
    const nfdPath = "docs/cafe\u0301/readme.md";
    expect(nfcDir.normalize("NFC") !== nfdPath.split("/").slice(0, 2).join("/")).toBe(true);
    expect(scopeScore({ ...base, directories: [nfcDir] }, {}, [nfdPath])).toBeGreaterThan(0);
  });
});
