import { describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("@company-brain/db", () => ({
  getDb,
  installations: { id: "id", githubInstallationId: "githubInstallationId", orgId: "orgId" },
  repos: { id: "id", installationId: "installationId" },
  repoSettings: {},
}));
vi.mock("../src/github/app", () => ({ getApp: vi.fn(), getInstallationOctokit: vi.fn() }));

import { resolveRepoById } from "../src/services/sync";

describe("resolveRepoById", () => {
  it("treats a malformed id as not found without querying (was a 500)", async () => {
    for (const bad of ["not-a-uuid", "undefined", "1", "' or 1=1--", ""]) {
      expect(await resolveRepoById(bad)).toBeNull();
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("still queries for a well-formed id", async () => {
    const limit = vi.fn(async () => []);
    getDb.mockReturnValue({
      select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }) }),
    });
    expect(await resolveRepoById("b4f82ca0-1ed5-43d8-8b85-985e95ac3d77")).toBeNull();
    expect(limit).toHaveBeenCalled();
  });
});
