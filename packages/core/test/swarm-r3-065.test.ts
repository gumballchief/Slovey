import { describe, it, expect, vi } from "vitest";

vi.mock("../src/services/plan-guard", () => ({
  isRepoWithinPlan: vi.fn(async () => ({ ok: false, plan: "free", limit: 1 })),
}));

vi.mock("../src/pipelines/retrieve", () => ({
  retrieveDecisions: vi.fn(async () => []),
}));

vi.mock("../src/ai", () => ({
  getAI: vi.fn(() => ({
    complete: vi.fn(async (prompt: string) =>
      prompt.includes("SMALLEST set")
        ? '{"files":[{"path":"a.ts","isNew":true,"reason":"test"}]}'
        : "console.log(1);\n",
    ),
  })),
}));

vi.mock("../src/github", () => ({
  getInstallationOctokit: vi.fn(async () => ({})),
}));

vi.mock("../src/github/write", () => ({
  getFileContent: vi.fn(async () => null),
  commitFilesToNewBranch: vi.fn(async () => "sha"),
  commitFilesToBranch: vi.fn(async () => "sha"),
  getCiStatus: vi.fn(async () => ({ configured: false, state: "none", summary: "none" })),
  openPullRequest: vi.fn(async () => ({ number: 1, url: "https://example.com/pr/1", draft: true })),
}));

vi.mock("../src/preflight/generated", () => ({
  checkGeneratedFile: vi.fn(async () => ({ blocked: false, problems: [], decisionViolations: [] })),
}));

vi.mock("../src/pipelines/check", () => ({
  checkPr: vi.fn(async () => ({ verdict: "clear", posted: false, checkId: null })),
}));

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(() => ({ select: () => ({ from: () => ({ where: async () => [] }) }) })),
  prChecks: {},
  repoKnowledge: {},
}));

import { runAgentTask } from "../src/pipelines/agent";

describe("R3-065 agent plan gate", () => {
  it("rejects over-limit repo before any AI/GitHub work", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: (...a: unknown[]) => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);
    await expect(
      runAgentTask({
        repoId: "repo-over-limit",
        installationId: 1,
        owner: "acme",
        name: "repo",
        fullName: "acme/repo",
        defaultBranch: "main",
        intent: "add hello",
      }),
    ).rejects.toThrow(/plan/i);
    vi.restoreAllMocks();
  });
});
