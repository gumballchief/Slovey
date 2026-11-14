import { describe, expect, it } from "vitest";
import { deriveConventions } from "../src/pipelines/index-repo";
import type { RepoArchitecture } from "../src/pipelines/index-repo";

describe("R6-191 test-runner convention follows config evidence", () => {
  it("picks Jest when only jest.config.js exists despite Vitest listed first", () => {
    const arch: RepoArchitecture = {
      languages: {},
      frameworks: [],
      services: [],
      apiRoutes: [],
      testStrategy: { hasTests: true, runners: ["Vitest", "Jest"], testFileCount: 10 },
      fileCount: 3,
      topLevelDirs: [],
      summary: "",
    };
    const paths = ["jest.config.js", "src/foo.test.ts", "package.json"];
    const out = deriveConventions(arch, [], paths);
    const testing = out.find((d) => d.category === "testing");
    expect(testing).toBeDefined();
    expect(testing!.decision).toContain("Jest");
    expect(testing!.decision).not.toContain("Vitest");
    expect(testing!.evidence).toContain("jest.config.js");
  });
});
