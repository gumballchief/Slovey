import { describe, it, expect } from "vitest";
import { getCiStatus } from "../src/github/write";
import type { InstallationOctokit } from "../src/github/app";

function errWithStatus(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function mockOctokit(statusImpl: () => Promise<unknown>, checksImpl: () => Promise<unknown>): InstallationOctokit {
  return {
    rest: {
      repos: { getCombinedStatusForRef: statusImpl },
      checks: { listForRef: checksImpl },
    },
  } as unknown as InstallationOctokit;
}

describe("getCiStatus error handling (R6-019)", () => {
  it("throws when both CI endpoints fail instead of reporting no CI", async () => {
    const octokit = mockOctokit(
      () => Promise.reject(errWithStatus("rate limit", 403)),
      () => Promise.reject(errWithStatus("server error", 500)),
    );
    await expect(getCiStatus(octokit, { owner: "o", repo: "r", ref: "abc" })).rejects.toThrow();
  });

  it("throws when one endpoint fails instead of deriving passing from the other", async () => {
    const octokit = mockOctokit(
      () => Promise.resolve({ data: { statuses: [] } }),
      () => Promise.reject(errWithStatus("server error", 500)),
    );
    await expect(getCiStatus(octokit, { owner: "o", repo: "r", ref: "abc" })).rejects.toThrow();
  });

  it("still reports no CI when both endpoints 404", async () => {
    const octokit = mockOctokit(
      () => Promise.reject(errWithStatus("not found", 404)),
      () => Promise.reject(errWithStatus("not found", 404)),
    );
    const res = await getCiStatus(octokit, { owner: "o", repo: "r", ref: "abc" });
    expect(res.configured).toBe(false);
  });
});
