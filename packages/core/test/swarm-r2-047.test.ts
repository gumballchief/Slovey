import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => [] }) }),
  }),
  prChecks: {},
  repoKnowledge: {},
}));

vi.mock("../src/pipelines/retrieve", () => ({
  retrieveDecisions: async () => [],
}));

vi.mock("../src/preflight/generated", () => ({
  checkGeneratedFile: async () => ({ blocked: false, problems: [], decisionViolations: [] }),
}));

vi.mock("../src/pipelines/check", () => ({
  checkPr: async () => ({ verdict: "clear", posted: false, reason: "ok", checkId: null }),
}));

vi.mock("../src/ai", () => ({
  getAI: () => ({
    complete: async () =>
      JSON.stringify({ files: [{ path: ".env.production", isNew: false, reason: "update secret" }] }),
  }),
}));

vi.mock("../src/github", () => ({
  getInstallationOctokit: async () => ({}),
}));

vi.mock("../src/github/write", () => ({
  getFileContent: async () => {
    throw new Error("UNPROTECTED-READ: secret file was read");
  },
  commitFilesToBranch: async () => "sha",
  commitFilesToNewBranch: async () => "sha",
  getCiStatus: async () => ({ configured: false, state: "none", summary: "none" }),
  openPullRequest: async () => ({ number: 1, url: "https://example.test/pr/1", draft: true }),
}));

import { runAgentTask } from "../src/pipelines/agent";

describe("R2-047 protected dotenv bypass", () => {
  it("refuses to read .env.production as an existing file", async () => {
    await expect(
      runAgentTask({
        repoId: "r1",
        installationId: 1,
        owner: "acme",
        name: "repo",
        fullName: "acme/repo",
        defaultBranch: "main",
        intent: "tweak prod secrets",
      }),
    ).rejects.toThrow(/protected/i);
  });
});
