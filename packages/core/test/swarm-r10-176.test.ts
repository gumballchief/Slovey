import { describe, expect, it } from "vitest";
import { shouldSkipManifestUpsert } from "../src/pipelines/index-repo";

describe("shouldSkipManifestUpsert (R10-176)", () => {
  it("skips overwrite when manifests are empty but package.json paths exist", () => {
    expect(shouldSkipManifestUpsert([], ["package.json"])).toBe(true);
  });

  it("does not skip when no manifests were expected", () => {
    expect(shouldSkipManifestUpsert([], [])).toBe(false);
  });

  it("does not skip when at least one manifest loaded", () => {
    expect(
      shouldSkipManifestUpsert(
        [{ path: "package.json", dependencies: {}, devDependencies: {} }],
        ["package.json"],
      ),
    ).toBe(false);
  });
});
