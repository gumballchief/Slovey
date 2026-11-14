import { describe, expect, it } from "vitest";
import { getChangedFiles, getDiff } from "../src/preflight/detect";

describe("R6-074 git-quoted unicode paths", () => {
  it("getDiff asks git for unquoted paths", () => {
    expect(getDiff.toString()).toContain("core.quotePath=false");
  });

  it("getChangedFiles asks git for unquoted paths", () => {
    expect(getChangedFiles.toString()).toContain("core.quotePath=false");
  });
});
