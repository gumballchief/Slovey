import { describe, expect, it } from "vitest";
import { stripPreflightArgv } from "../src/cli";

describe("R10-275 preflight argv filtering", () => {
  it("keeps a branch value equal to preflight", () => {
    expect(stripPreflightArgv(["preflight", "override", "abc", "--reason", "x", "--branch", "preflight"])).toEqual([
      "override",
      "abc",
      "--reason",
      "x",
      "--branch",
      "preflight",
    ]);
  });

  it("keeps an explain id equal to preflight", () => {
    expect(stripPreflightArgv(["preflight", "explain", "preflight"])).toEqual(["explain", "preflight"]);
  });

  it("leaves args without the leading subcommand alone", () => {
    expect(stripPreflightArgv(["override", "abc", "--branch", "preflight"])).toEqual([
      "override",
      "abc",
      "--branch",
      "preflight",
    ]);
  });
});
