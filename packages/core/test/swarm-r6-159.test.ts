import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { fetchDocs } from "../src/github/fetchers";

function mockOctokitWithTreeError(err: unknown): InstallationOctokit {
  return {
    rest: {
      git: {
        getTree: async () => {
          throw err;
        },
        getBlob: async () => {
          throw new Error("should not be called");
        },
      },
    },
  } as unknown as InstallationOctokit;
}

describe("fetchDocs missing default branch", () => {
  it("returns [] when the tree is missing (404)", async () => {
    const err = Object.assign(new Error("Not Found"), { status: 404 });
    const octokit = mockOctokitWithTreeError(err);
    await expect(fetchDocs(octokit, "owner", "empty-repo", "main")).resolves.toEqual([]);
  });

  it("returns [] on empty-repo conflict (409)", async () => {
    const err = Object.assign(new Error("Conflict"), { status: 409 });
    const octokit = mockOctokitWithTreeError(err);
    await expect(fetchDocs(octokit, "owner", "empty-repo", "main")).resolves.toEqual([]);
  });
});
