import { describe, it, expect } from "vitest";
import { isInteractiveHuman, stripOverrideHint, stripOverrideSteps } from "../src/cli";

describe("R2-007 human-only override gate", () => {
  it("strips the override command from agent instruction text", () => {
    const input = 'Fix the violation.\nRun slovey preflight override abc123 --reason "approved" to fix.\nDone.';
    const out = stripOverrideHint(input);
    expect(out).not.toContain("preflight override");
    expect(out).toContain("Fix the violation.");
    expect(out).toContain("Done.");
  });

  it("filters override steps from nextSteps", () => {
    const steps = ["Fix foo", 'run slovey preflight override xyz --reason "ok"'];
    expect(stripOverrideSteps(steps)).toEqual(["Fix foo"]);
  });

  it("refuses non-interactive agent context", () => {
    expect(isInteractiveHuman()).toBe(false);
  });
});
