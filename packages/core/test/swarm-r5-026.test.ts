import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app.js";
import { fetchPrForCheck } from "../src/github/fetchers.js";

describe("R5-026 missing patch must be fail-closed", () => {
  it("flags binary/large file with no patch as truncated", async () => {
    const files = [
      { filename: "src/auth/check.ts", additions: 50, deletions: 10 },
      { filename: "README.md", additions: 1, deletions: 1, patch: "@@ tiny" },
    ];
    const octokit = {
      rest: {
        pulls: {
          get: async () => ({
            data: { title: "t", body: "b", user: { login: "alice" }, head: { sha: "abc123" } },
          }),
          listFiles: async () => ({ data: files }),
        },
      },
    } as unknown as InstallationOctokit;
    const pr = await fetchPrForCheck(octokit, "o", "r", 1);
    expect(pr.diffSummary).toContain("[patch unavailable: binary/large file]");
    expect(pr.diffSummary).toContain("incomplete diff");
  });
});
