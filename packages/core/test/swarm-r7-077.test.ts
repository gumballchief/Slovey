import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  repoKnowledge: { repoId: "repoId", kind: "kind" },
}));

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: vi.fn(),
}));

vi.mock("../src/ai", () => ({
  getAI: vi.fn(),
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { getAI } from "../src/ai";
import type { AIProvider } from "../src/ai/types";
import { getInstallationOctokit } from "../src/github/app";
import type { InstallationOctokit } from "../src/github/app";
import { runIndexRepo } from "../src/pipelines/index-repo";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

function setup(truncated: boolean) {
  const getTree = vi.fn().mockResolvedValue({
    data: {
      truncated,
      tree: [{ type: "blob", path: "apps/web/index.ts", sha: "abc123" }],
    },
  });
  const getBlob = vi.fn().mockResolvedValue({
    data: {
      content: Buffer.from(
        JSON.stringify({ name: "web", dependencies: {}, devDependencies: {} }),
      ).toString("base64"),
    },
  });
  const octokit = {
    rest: { git: { getTree, getBlob } },
  } as unknown as InstallationOctokit;
  vi.mocked(getInstallationOctokit).mockResolvedValue(octokit);

  vi.mocked(getAI).mockReturnValue({
    name: "mock",
    complete: async () => "",
    completeJSON: async () => ({ summary: "mock summary" }),
  } as unknown as AIProvider);

  const where = vi.fn();
  const values = vi.fn();
  const tx = {
    delete: vi.fn(() => ({ where })),
    insert: vi.fn(() => ({ values })),
  };
  const transaction = vi.fn(async (cb: (t: typeof tx) => Promise<void>) => {
    await cb(tx);
  });
  vi.mocked(getDb).mockReturnValue({ transaction } as unknown as ReturnType<typeof getDb>);
  vi.mocked(upsertDecisions).mockResolvedValue({ inserted: 0, updated: 0 });
  return { transaction, tx };
}

describe("R7-077 truncated tree must not overwrite stored knowledge", () => {
  it("does not run the knowledge delete+insert transaction when tree is truncated", async () => {
    const { transaction } = setup(true);
    await runIndexRepo({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      defaultBranch: "main",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("still persists knowledge when tree is complete", async () => {
    const { transaction } = setup(false);
    await runIndexRepo({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      defaultBranch: "main",
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
