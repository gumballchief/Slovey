import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { fetchPrForCheck } from "../src/github/fetchers";

function makeOctokit(patch: string): InstallationOctokit {
  const octokit = {
    rest: {
      pulls: {
        get: async () => ({
          data: { title: "big change", body: "b", user: { login: "alice" }, head: { sha: "abc123" } },
        }),
        listFiles: async ({ page }: { page?: number }) => {
          if ((page ?? 1) > 1) return { data: [] };
          return {
            data: [{ filename: "src/big.ts", additions: 100, deletions: 10, patch }],
          };
        },
      },
    },
  };
  return octokit as unknown as InstallationOctokit;
}

describe("R6-016 single large-file PR diff", () => {
  it("includes the only file even when its truncated patch exceeds the total cap", async () => {
    const bigPatch = `@@ -1 +1 @@\n${"x".repeat(5000)}`;
    const result = await fetchPrForCheck(makeOctokit(bigPatch), "o", "r", 1);
    expect(result.changedFiles).toEqual(["src/big.ts"]);
    expect(result.diffSummary).toContain("src/big.ts");
    expect(result.diffSummary).toContain("x".repeat(10));
  });
});
