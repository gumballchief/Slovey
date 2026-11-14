import { describe, expect, it, vi } from "vitest";
import { getCiStatus } from "../src/github/write";
import type { InstallationOctokit } from "../src/github/app";

function makeRun(i: number, conclusion: string | null, status = "completed") {
  return { name: `run-${i}`, conclusion, status };
}

describe("getCiStatus pagination", () => {
  it("includes failing check runs beyond the first page", async () => {
    // 100 passing on page 1, a failing run only on page 2 (101st run).
    const page1 = Array.from({ length: 100 }, (_, i) => makeRun(i, "success"));
    const page2 = [makeRun(100, "failure")];
    const listForRef = vi.fn(async (opts: { page?: number }) => ({
      data: { total_count: 101, check_runs: opts.page === 2 ? page2 : page1 },
    }));
    const octokit = {
      rest: {
        repos: {
          getCombinedStatusForRef: vi.fn(async () => ({ data: { statuses: [] } })),
        },
        checks: { listForRef },
      },
    } as unknown as InstallationOctokit;
    const result = await getCiStatus(octokit, { owner: "o", repo: "r", ref: "abc" });
    expect(listForRef.mock.calls.length).toBeGreaterThan(1);
    expect(result.state).toBe("failing");
    expect(result.summary).toContain("run-100");
  });
});
