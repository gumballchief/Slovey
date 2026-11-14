import { describe, expect, it, vi } from "vitest";
import { fetchPrForCheck } from "../src/github/fetchers";

describe("fetchPrForCheck pagination", () => {
  it("includes files beyond the first 100-file page", async () => {
    const allFiles = Array.from({ length: 120 }, (_, i) => ({
      filename: i === 100 ? "src/secrets.ts" : `vendor/file-${i}.ts`,
      additions: 1,
      deletions: 0,
      patch: `patch-${i}`,
    }));
    const listFiles = vi.fn(async ({ per_page = 100, page = 1 }: { per_page?: number; page?: number }) => ({
      data: allFiles.slice((page - 1) * per_page, page * per_page),
    }));
    const octokit = {
      rest: {
        pulls: {
          get: vi.fn(async () => ({
            data: {
              title: "big PR",
              body: "",
              user: { login: "alice" },
              head: { sha: "abc123" },
            },
          })),
          listFiles,
        },
      },
    };
    const result = await fetchPrForCheck(octokit as never, "acme", "repo", 7);
    expect(listFiles.mock.calls.length).toBeGreaterThan(1);
    expect(result.changedFiles).toHaveLength(120);
    expect(result.changedFiles[100]).toBe("src/secrets.ts");
    expect(result.changedFiles).toContain("src/secrets.ts");
    expect(result.diffSummary).toContain("src/secrets.ts");
  });
});
