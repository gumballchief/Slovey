import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/config", () => ({
  loadEnv: () => ({ ALLOWLIST_REPOS: [] as string[] }),
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: vi.fn(),
}));

vi.mock("../src/queue", () => ({
  JOBS: { extract: "extract", checkPr: "checkPr" },
  enqueue: vi.fn(),
}));

vi.mock("../src/services/sync", () => ({
  listAllRepos: vi.fn(),
  resolveRepoById: vi.fn(),
}));

vi.mock("../src/pipelines/reactions", () => ({
  pollReactionDismissals: vi.fn(),
}));

import { runRefreshMemory } from "../src/pipelines/rescan";
import { enqueue } from "../src/queue";
import { listAllRepos } from "../src/services/sync";

describe("runRefreshMemory per-repo isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("queues remaining repos when one enqueue fails", async () => {
    vi.mocked(listAllRepos).mockResolvedValue([
      { repoId: "r1", owner: "acme", ownerGithubId: 1, name: "one", fullName: "acme/one", defaultBranch: "main", installationGithubId: 11, orgId: "o1" },
      { repoId: "r2", owner: "acme", ownerGithubId: 1, name: "two", fullName: "acme/two", defaultBranch: "main", installationGithubId: 11, orgId: "o1" },
      { repoId: "r3", owner: "acme", ownerGithubId: 1, name: "three", fullName: "acme/three", defaultBranch: "main", installationGithubId: 11, orgId: "o1" },
    ]);
    vi.mocked(enqueue).mockResolvedValue("ok");
    vi.mocked(enqueue).mockRejectedValueOnce(new Error("boss down"));

    const result = await runRefreshMemory();

    expect(result.repos).toBe(3);
    expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(3);
  });
});
