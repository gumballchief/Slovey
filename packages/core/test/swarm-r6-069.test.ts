import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readChanged } from "../src/preflight/checks";

const here = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(here, "..");

describe("R6-069 quoted git paths", () => {
  it("reads a C-quoted path instead of skipping it", () => {
    const got = readChanged(cwd, ['"package.json"']);
    expect(got.length).toBe(1);
    expect(got[0]!.path).toBe("package.json");
    expect(got[0]!.content).toContain("name");
  });
  it("decodes octal escapes (git core.quotePath) before resolve", () => {
    // \056 is '.' so this decodes to package.json
    const got = readChanged(cwd, ['"package\\056json"']);
    expect(got.length).toBe(1);
    expect(got[0]!.path).toBe("package.json");
  });
});
