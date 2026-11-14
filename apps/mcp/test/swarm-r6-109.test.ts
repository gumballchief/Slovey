import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripOverrideHint } from "../src/cli.js";

function installSection(): string {
  const src = readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8");
  const start = src.indexOf("function installHooks");
  const end = src.indexOf("function uninstallHooks");
  return src.slice(start, end === -1 ? undefined : end);
}

describe("R6-109 installHooks preserves foreign hooks", () => {
  it("refuses to overwrite hooks without the Slovey marker", () => {
    expect(stripOverrideHint("a\nb preflight override c\nd")).not.toContain("preflight override");
    const section = installSection();
    expect(section).toContain("function installHooks");
    expect(section).toMatch(/existsSync\(/);
    expect(section).toContain("HOOK_MARKER");
    expect(section).toContain("LEGACY_HOOK_MARKER");
    expect(section).toMatch(/continue|\.bak|chain/i);
    expect(section).toMatch(/merge manually|not installed by Slovey|already exists|will not overwrite/i);
  });
});
