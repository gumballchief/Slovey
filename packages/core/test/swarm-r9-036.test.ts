import { describe, expect, it } from "vitest";
import { PROTECTED_PATH } from "../src/pipelines/agent";

describe("R9-036: PROTECTED_PATH covers non-GitHub CI", () => {
  it.each([
    ".gitlab-ci.yml",
    "azure-pipelines.yml",
    ".circleci/config.yml",
    ".travis.yml",
    "Jenkinsfile",
    ".buildkite/pipeline.yml",
  ])("blocks %s", (p) => {
    expect(PROTECTED_PATH.test(p)).toBe(true);
  });

  it("still blocks GitHub Actions", () => {
    expect(PROTECTED_PATH.test(".github/workflows/ci.yml")).toBe(true);
  });

  it("allows normal source files", () => {
    expect(PROTECTED_PATH.test("src/app.ts")).toBe(false);
  });
});
