import { describe, expect, it } from "vitest";
import { fetchPrForCheck } from "../src/github/fetchers";
import type { InstallationOctokit } from "../src/github/app";

function mockOctokit(): InstallationOctokit {
  const files = [
    {
      filename: "README.md",
      status: "modified",
      previous_filename: undefined,
      additions: 1,
      deletions: 1,
      patch: "innocuous readme tweak",
    },
    {
      filename: "docs/guide.md",
      status: "renamed",
      previous_filename: "src/auth.ts",
      additions: 5,
      deletions: 5,
      patch: "moved auth logic here",
    },
  ];
  const octokit = {
    rest: {
      pulls: {
        get: async () => ({
          data: {
            title: "rename",
            body: "",
            user: { login: "alice" },
            head: { sha: "abc123" },
          },
        }),
        listFiles: async () => ({ data: files }),
      },
    },
  };
  return octokit as unknown as InstallationOctokit;
}

describe("R9-188 rename visibility", () => {
  it("exposes previous_filename in changedFiles, header, and suspicious ordering", async () => {
    const pr = await fetchPrForCheck(mockOctokit(), "o", "r", 1);
    expect(pr.changedFiles).toContain("docs/guide.md");
    expect(pr.changedFiles).toContain("src/auth.ts");
    expect(pr.diffSummary).toContain("src/auth.ts => docs/guide.md");
    // Rename away from a sensitive name must be prioritized first.
    expect(pr.diffSummary.indexOf("src/auth.ts")).toBeGreaterThanOrEqual(0);
    expect(pr.diffSummary.indexOf("src/auth.ts")).toBeLessThan(
      pr.diffSummary.indexOf("README.md"),
    );
  });
});
