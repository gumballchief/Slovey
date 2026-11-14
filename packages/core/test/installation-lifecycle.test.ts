import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  inserts: 0,
  request: vi.fn(),
  listRepos: vi.fn(),
}));

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            h.updates.push(v);
            return [{ orgId: "org-1" }];
          },
        }),
      }),
    }),
    insert: () => {
      h.inserts++;
      throw new Error("must not insert");
    },
    select: () => ({ from: () => ({ where: async () => [] }) }),
  }),
  installations: { githubInstallationId: "githubInstallationId", suspendedAt: "suspendedAt", orgId: "orgId", id: "id" },
  repos: {},
  repoSettings: {},
}));
vi.mock("../src/github/app", () => ({
  getApp: () => ({ octokit: { request: h.request } }),
  getInstallationOctokit: async () => ({ rest: { apps: { listReposAccessibleToInstallation: h.listRepos } } }),
}));
vi.mock("../src/services/audit", () => ({ logAudit: vi.fn() }));
vi.mock("../src/services/orgs", () => ({
  ensureOrg: vi.fn(),
  ensureOwnerMembership: vi.fn(),
  getUserIdByGithubId: vi.fn(),
  userOrgRole: vi.fn(),
}));

import { reconcileInstallations, syncInstallation } from "../src/services/sync";

beforeEach(() => {
  h.updates.length = 0;
  h.inserts = 0;
  h.request.mockReset();
  h.listRepos.mockReset();
});

describe("installation lifecycle", () => {
  it("an uninstalled app (GitHub 404) is marked inactive instead of failing forever", async () => {
    h.request.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    expect(await syncInstallation(123)).toBeNull();
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]!.suspendedAt).toBeInstanceOf(Date);
    expect(h.inserts).toBe(0);
  });

  it("a suspended install is marked inactive without trying to list its repos", async () => {
    h.request.mockResolvedValue({ data: { account: { id: 1, login: "x", type: "User" }, suspended_at: "2026-11-14T00:00:00Z" } });
    expect(await syncInstallation(123)).toBeNull();
    expect(h.updates[0]!.suspendedAt).toEqual(new Date("2026-11-14T00:00:00Z"));
    expect(h.listRepos).not.toHaveBeenCalled();
  });

  it("other GitHub errors still fail the job (so it retries) and change nothing", async () => {
    h.request.mockRejectedValue(Object.assign(new Error("Server Error"), { status: 502 }));
    await expect(syncInstallation(123)).rejects.toThrow("Server Error");
    expect(h.updates).toHaveLength(0);
  });

  it("the nightly reconcile never deactivates anything when GitHub's list fails", async () => {
    h.request.mockRejectedValue(Object.assign(new Error("Bad credentials"), { status: 401 }));
    await expect(reconcileInstallations()).rejects.toThrow("Bad credentials");
    expect(h.updates).toHaveLength(0);
  });
});
