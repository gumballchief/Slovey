import { describe, expect, it, vi } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { commitFilesToBranch } from "../src/github/write";

describe("R10-015 getTree failure must not commit with empty modes", () => {
  it("throws when getTree fails instead of committing everything as 100644", async () => {
    const createTree = vi.fn(async () => ({ data: { sha: "new-tree" } }));
    const octokit = {
      rest: {
        git: {
          getRef: async () => ({ data: { object: { sha: "base-sha" } } }),
          getCommit: async () => ({ data: { tree: { sha: "base-tree-sha" } } }),
          getTree: async () => {
            throw new Error("getTree 500 transient");
          },
          createBlob: async () => ({ data: { sha: "blob-sha" } }),
          createTree,
          createCommit: async () => ({ data: { sha: "commit-sha" } }),
          updateRef: async () => ({}),
        },
      },
    } as unknown as InstallationOctokit;

    await expect(
      commitFilesToBranch(octokit, {
        owner: "o",
        repo: "r",
        branch: "agent-branch",
        message: "msg",
        files: [{ path: "run.sh", content: "hi" }],
      }),
    ).rejects.toThrow("getTree 500 transient");
    expect(createTree).not.toHaveBeenCalled();
  });
});
