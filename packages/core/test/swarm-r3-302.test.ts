import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => ({
  installations: { githubInstallationId: "githubInstallationId" },
  repos: { fullName: "fullName" },
  repoSettings: {},
  getDb: vi.fn(),
}));

vi.mock("../src/github/app", () => ({
  getApp: vi.fn(),
  getInstallationOctokit: vi.fn(),
}));

vi.mock("../src/services/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../src/services/orgs", () => ({
  ensureOrg: vi.fn(),
  ensureOwnerMembership: vi.fn(),
  getUserIdByGithubId: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { getApp, getInstallationOctokit } from "../src/github/app";
import { ensureOrg } from "../src/services/orgs";
import { syncInstallation } from "../src/services/sync";

function makeRepo(i: number) {
  return {
    id: 1000 + i,
    owner: { login: "acme", id: 1 },
    name: `repo-${i}`,
    full_name: `acme/repo-${i}`,
    default_branch: "main",
    private: false,
  };
}

describe("syncInstallation pagination (R3-302)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs repos beyond the first 100", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeRepo(i));
    const page2 = [makeRepo(100)];
    const listFn = vi.fn(async ({ page }: { per_page: number; page?: number }) => {
      const p = page ?? 1;
      if (p === 1) return { data: { repositories: page1 } };
      if (p === 2) return { data: { repositories: page2 } };
      return { data: { repositories: [] } };
    });

    const insertedFullNames: string[] = [];
    const fakeDb = {
      insert: (table: unknown) => ({
        values: (vals: Record<string, unknown>) => ({
          onConflictDoUpdate: (_opts: unknown) => ({
            returning: async () => {
              if (table !== null && typeof table === "object" && "fullName" in (table as object)) {
                insertedFullNames.push(vals["fullName"] as string);
                return [{ id: `id-${vals["fullName"]}` }];
              }
              return [{ id: "inst-id" }];
            },
          }),
          onConflictDoNothing: async () => [],
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(fakeDb as never);
    vi.mocked(ensureOrg).mockResolvedValue("org-1" as never);
    vi.mocked(getApp).mockReturnValue({
      octokit: {
        request: async () => ({ data: { account: { login: "acme", type: "Organization" } } }),
      },
    } as never);
    vi.mocked(getInstallationOctokit).mockResolvedValue({
      rest: { apps: { listReposAccessibleToInstallation: listFn } },
    } as never);

    await syncInstallation(123);

    expect(listFn).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(insertedFullNames).toHaveLength(101);
    expect(insertedFullNames).toContain("acme/repo-100");
  });
});
