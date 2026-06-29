import { describe, expect, it } from "vitest";
import { statusForVerdict } from "../src/pipelines/check";

describe("statusForVerdict (status_check merge gate)", () => {
  it("fails the commit status on a conflict, with the explanation", () => {
    const s = statusForVerdict("conflict", "Adds a fly.toml deploy config");
    expect(s.state).toBe("failure");
    expect(s.description).toContain("fly.toml");
  });

  it("falls back to a generic message when no explanation is given", () => {
    expect(statusForVerdict("conflict").description).toMatch(/past team decision/i);
  });

  it("passes the status on a clear PR so a required check can go green", () => {
    expect(statusForVerdict("clear").state).toBe("success");
  });

  it("stays pending for an indeterminate (skipped) verdict — never green-lights", () => {
    expect(statusForVerdict("skipped").state).toBe("pending");
  });

  it("truncates long explanations to GitHub's 140-char status limit", () => {
    const long = "x".repeat(300);
    expect(statusForVerdict("conflict", long).description.length).toBeLessThanOrEqual(140);
  });
});
