import { describe, expect, it } from "vitest";
import { runPreflight } from "../src/preflight/engine";

describe("R10-061 unknown required check", () => {
  it("fails the gate instead of passing silently", async () => {
    const result = await runPreflight({
      cwd: "/tmp",
      requiredChecks: ["typechek"],
      configOverride: { optionalChecks: [] },
      changedFiles: ["foo.ts"],
      persist: false,
    });
    const unknown = result.checks.find((c) => c.name === "typechek");
    expect(unknown).toBeDefined();
    expect(unknown!.blocking).toBe(true);
    expect(unknown!.status).toBe("fail");
    expect(result.warnings.some((w) => w.includes("typechek"))).toBe(true);
    expect(result.status).not.toBe("pass");
    expect(result.safeToCommit).toBe(false);
  });
});
