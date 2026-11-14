import { describe, it, expect } from "vitest";
import { fetchPrForCheck } from "../src/github/fetchers";

describe("R3-042 diff summary truncation", () => {
  it("keeps later files visible when first file is huge", async () => {
    const bigPatch = "benign\n".repeat(600);
    const secretPatch = "forbidden change: disable auth check SECRET_TOKEN_XYZ";
    const octokit = {
      rest: {
        pulls: {
          get: async () => ({
            data: { title: "t", body: "b", user: { login: "a" }, head: { sha: "sha" } },
          }),
          listFiles: async () => ({
            data: [
              { filename: "generated/big.ts", additions: 600, deletions: 0, patch: bigPatch },
              { filename: "auth/check.ts", additions: 1, deletions: 0, patch: secretPatch },
            ],
          }),
        },
      },
    } as any;
    const pr = await fetchPrForCheck(octokit, "o", "r", 1);
    expect(pr.diffSummary).toContain("auth/check.ts");
    expect(pr.diffSummary).toContain("SECRET_TOKEN_XYZ");
  });
});
