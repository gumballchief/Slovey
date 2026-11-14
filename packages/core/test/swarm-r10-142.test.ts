import { describe, expect, it } from "vitest";
import { fetchClosedPRs } from "../src/github/fetchers";
import type { InstallationOctokit } from "../src/github/app";

describe("R10-142 newest discussion", () => {
  it("preserves the final verdict when a PR has >30 comments", async () => {
    const bodies: string[] = [];
    for (let i = 0; i < 40; i++) {
      bodies.push(`comment-${i} ${"x".repeat(80)}`);
    }
    bodies[39] = `comment-39 FINAL_VERDICT_ABC123 ${"y".repeat(80)}`;
    const octokit = {
      rest: {
        pulls: {
          list: async () => ({
            data: [{ number: 1, title: "t", body: "b", merged_at: "2024-01-02T00:00:00Z" }],
          }),
          listReviewComments: async () => ({ data: [] }),
          listReviews: async () => ({ data: [] }),
        },
        issues: {
          listComments: async (args: { per_page?: number; page?: number }) => {
            const perPage = args.per_page ?? 30;
            const page = args.page ?? 1;
            const start = (page - 1) * perPage;
            return {
              data: bodies.slice(start, start + perPage).map((body) => ({ body })),
            };
          },
        },
      },
    } as unknown as InstallationOctokit;
    const prs = await fetchClosedPRs(octokit, "o", "r");
    expect(prs).toHaveLength(1);
    expect(prs[0].discussion).toContain("FINAL_VERDICT_ABC123");
  });
});
