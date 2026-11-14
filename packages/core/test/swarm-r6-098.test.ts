import { describe, it, expect, vi } from "vitest";
import { syncInstallation } from "../src/services/sync";
import { getDb } from "@company-brain/db";
import { getApp, getInstallationOctokit } from "../src/github/app";
import { ensureOrg } from "../src/services/orgs";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  installations: { githubInstallationId: "githubInstallationId", id: "id", orgId: "orgId" },
  repos: { fullName: "fullName", id: "id", githubRepoId: "githubRepoId" },
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
  userOrgRole: vi.fn(),
}));

vi.mock("../src/services/audit", () => ({
  logAudit: vi.fn(),
}));

const hoisted = vi.hoisted(() => ({
  repoConflict: null as { target: unknown; set: Record<string, unknown> } | null,
  staleMoves: 0,
}));

describe("R6-098 / R10-082 repo identity is GitHub's repo id", () => {
  it("upserts on githubRepoId and refreshes the name, moving a stale holder of the name aside", async () => {
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
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      update: () => ({
        set: () => ({
          where: async () => {
            hoisted.staleMoves += 1;
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: () => ({
          onConflictDoUpdate: (conf: { target: unknown; set: Record<string, unknown> }) => ({
            returning: async () => {
              const t = table as Record<string, unknown>;
              if (t && t["fullName"] === "fullName") {
                hoisted.repoConflict = conf;
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

    expect(hoisted.repoConflict).not.toBeNull();
    expect(hoisted.repoConflict!.target).toBe("githubRepoId");
    expect(hoisted.repoConflict!.set["fullName"]).toBe("acme/myrepo");
    expect(hoisted.repoConflict!.set["name"]).toBe("myrepo");
    expect(hoisted.staleMoves).toBe(1);
  });
});
