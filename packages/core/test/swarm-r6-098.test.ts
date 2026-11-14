import { describe, it, expect, vi } from "vitest";
import { syncInstallation } from "../src/services/sync";
import { getDb } from "@company-brain/db";
import { getApp, getInstallationOctokit } from "../src/github/app";
import { ensureOrg } from "../src/services/orgs";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  installations: { githubInstallationId: "githubInstallationId", id: "id" },
  repos: { fullName: "fullName", id: "id" },
  repoSettings: {},
}));

vi.mock("../src/github/app", () => ({
  getApp: vi.fn(),
  getInstallationOctokit: vi.fn(),
}));

vi.mock("../src/services/orgs", () => ({
  ensureOrg: vi.fn(),
  ensureOwnerMembership: vi.fn(),
  getUserIdByGithubId: vi.fn(),
}));

vi.mock("../src/services/audit", () => ({
  logAudit: vi.fn(),
}));

const hoisted = vi.hoisted(() => ({ repoSet: null as Record<string, unknown> | null }));

describe("R6-098 recreated repo keeps stale GitHub ID", () => {
  it("refreshes githubRepoId and name on fullName conflict", async () => {
    const fakeRepo = {
      id: 999,
      owner: { login: "acme", id: 42 },
      name: "myrepo",
      full_name: "acme/myrepo",
      default_branch: "main",
      private: false,
    };

    vi.mocked(ensureOrg).mockResolvedValue("org-1");
    vi.mocked(getApp).mockReturnValue({
      octokit: {
        request: async () => ({
          data: { account: { login: "acme", id: 1, type: "Organization" } },
        }),
      },
    } as unknown as ReturnType<typeof getApp>);
    vi.mocked(getInstallationOctokit).mockResolvedValue({
      rest: {
        apps: {
          listReposAccessibleToInstallation: async () => ({
            data: { repositories: [fakeRepo] },
          }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof getInstallationOctokit>>);

    const fakeDb = {
      insert: (table: unknown) => ({
        values: (vals: unknown) => ({
          onConflictDoUpdate: (conf: { set: Record<string, unknown> }) => ({
            returning: async () => {
              const t = table as Record<string, unknown>;
              if (t && t["fullName"] === "fullName") {
                hoisted.repoSet = conf.set;
                return [{ id: "repo-row-1" }];
              }
              return [{ id: "inst-1" }];
            },
          }),
          onConflictDoNothing: () => Promise.resolve([]),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

    await syncInstallation(123);

    expect(hoisted.repoSet).not.toBeNull();
    const setRow = hoisted.repoSet as Record<string, unknown>;
    expect(setRow["githubRepoId"]).toBe(999);
    expect(setRow["name"]).toBe("myrepo");
  });
});
