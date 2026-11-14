import { describe, expect, it } from "vitest";
import { deriveConventions, isGitTreeTruncated } from "../src/pipelines/index-repo";

describe("R6-046 truncated git tree", () => {
  it("detects truncated trees so partial paths are not treated as complete", () => {
    expect(isGitTreeTruncated({ truncated: true })).toBe(true);
    expect(isGitTreeTruncated({ truncated: false })).toBe(false);
    expect(isGitTreeTruncated({})).toBe(false);
    expect(isGitTreeTruncated(null)).toBe(false);
    expect(isGitTreeTruncated(undefined)).toBe(false);
  });

  it("still derives conventions from a complete tree", () => {
    const arch = {
      languages: {},
      frameworks: [],
      services: [],
      apiRoutes: [],
      testStrategy: { hasTests: false, runners: [], testFileCount: 0 },
      fileCount: 2,
      topLevelDirs: [],
      summary: "",
    };
    const manifests = [
      { path: "package.json", dependencies: { "drizzle-orm": "^1.0.0" }, devDependencies: {} },
    ];
    const derived = deriveConventions(arch, manifests, ["package.json", "src/schema.ts"]);
    expect(derived.length).toBeGreaterThan(0);
  });
});
