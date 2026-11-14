import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { commitFilesToBranch } from "../src/github/write";

describe("R6-163 preserves file mode on overwrite", () => {
  it("reuses 100755 and 120000 from base tree, defaults new files to 100644", async () => {
    const captured: { path?: string; mode?: string }[] = [];
    const mockGit = {
      getRef: async () => ({ data: { object: { sha: "base-sha" } } }),
      getCommit: async () => ({ data: { tree: { sha: "base-tree-sha" } } }),
      getTree: async () => ({
        data: {
          tree: [
            { path: "scripts/deploy.sh", mode: "100755", type: "blob", sha: "a" },
            { path: "link", mode: "120000", type: "blob", sha: "b" },
            { path: "plain.txt", mode: "100644", type: "blob", sha: "c" },
          ],
        },
      }),
      createBlob: async () => ({ data: { sha: "blob-sha" } }),
      createTree: async (_args: { tree: { path?: string; mode?: string }[] }) => {
        captured.push(..._args.tree);
        return { data: { sha: "new-tree-sha" } };
      },
      createCommit: async () => ({ data: { sha: "new-commit-sha" } }),
      updateRef: async () => ({ data: {} }),
    };
    const octokit = { rest: { git: mockGit } } as unknown as InstallationOctokit;
    await commitFilesToBranch(octokit, {
      owner: "o",
      repo: "r",
      branch: "agent-branch",
      message: "edit",
      files: [
        { path: "scripts/deploy.sh", content: "new" },
        { path: "link", content: "new-target" },
        { path: "brand-new.txt", content: "hello" },
      ],
    });
    const byPath = new Map(captured.map((e) => [e.path, e.mode]));
    expect(byPath.get("scripts/deploy.sh")).toBe("100755");
    expect(byPath.get("link")).toBe("120000");
    expect(byPath.get("brand-new.txt")).toBe("100644");
  });
});
