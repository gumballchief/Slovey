import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { fetchPrForCheck } from "../src/github/fetchers";

describe("R7-039 dummy file must not push real patch out", () => {
  it("keeps a bounded slice of the second file and flags truncation", async () => {
    const dummyPatch = "DUMMY:" + "A".repeat(5000);
    const realPatch = "BYPASS_PAYMENT_MARKER:" + "B".repeat(5000);
    const files = [
      { filename: "auth-dummy.txt", additions: 100, deletions: 0, patch: dummyPatch },
      { filename: "src/payments/charge.ts", additions: 50, deletions: 1, patch: realPatch },
    ];
    const octokit = {
      rest: {
        pulls: {
          get: async () => ({
            data: { title: "t", body: "b", user: { login: "alice" }, head: { sha: "abc" } },
          }),
          listFiles: async () => ({ data: files }),
        },
      },
    } as unknown as InstallationOctokit;
    const pr = await fetchPrForCheck(octokit, "o", "r", 1);
    expect(pr.diffSummary).toContain("auth-dummy.txt");
    expect(pr.diffSummary).toContain("src/payments/charge.ts");
    expect(pr.diffSummary).toContain("BYPASS_PAYMENT_MARKER");
    expect(pr.truncated).toBe(true);
    expect(pr.diffSummary.length).toBeLessThan(4000);
  });
});
