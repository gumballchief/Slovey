import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { fetchPrForCheck } from "../src/github/fetchers";

interface FakeFile {
  filename: string;
  additions: number;
  deletions: number;
  patch?: string;
}

function makeOctokit(files: FakeFile[]): InstallationOctokit {
  const octokit = {
    rest: {
      pulls: {
        get: async () => ({
          data: {
            title: "big pr",
            body: "body",
            user: { login: "alice" },
            head: { sha: "abc123" },
          },
        }),
        listFiles: async (args: { page?: number; per_page?: number }) => {
          const page = args.page ?? 1;
          const per = args.per_page ?? 100;
          const start = (page - 1) * per;
          return { data: files.slice(start, start + per) };
        },
      },
    },
  };
  return octokit as unknown as InstallationOctokit;
}

describe("R4-040 many-file diff budget", () => {
  it("keeps suspicious patch visible, caps total length, and flags truncation", async () => {
    const files: FakeFile[] = [];
    for (let i = 0; i < 400; i++) {
      files.push({
        filename: `trivial/file-${i}.txt`,
        additions: 1,
        deletions: 0,
        patch: `trivial line ${i}`,
      });
    }
    files.push({
      filename: "src/auth.ts",
      additions: 10,
      deletions: 2,
      patch: "BYPASS_AUTH_MARKER if (password === 'x') return true;",
    });
    const octokit = makeOctokit(files);
    const pr = await fetchPrForCheck(octokit, "o", "r", 1);
    expect(pr.changedFiles).toHaveLength(401);
    expect(pr.diffSummary).toContain("BYPASS_AUTH_MARKER");
    expect(pr.diffSummary).toMatch(/incomplete diff/i);
    expect(pr.diffSummary.length).toBeLessThanOrEqual(5000);
  });
});
