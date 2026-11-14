import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/queue", () => ({
  JOBS: { extract: "extract" },
  enqueue: vi.fn(),
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [] }),
}));

vi.mock("../src/memory", () => ({
  reinforce: vi.fn(async () => undefined),
}));

vi.mock("@company-brain/db", () => ({
  agentRuns: { id: "agentRuns.id" },
  auditLogs: { id: "auditLogs.id" },
  decisions: { id: "decisions.id" },
  feedback: { id: "feedback.id" },
  installations: {
    id: "installations.id",
    githubInstallationId: "installations.githubInstallationId",
    orgId: "installations.orgId",
    accountLogin: "installations.accountLogin",
  },
  memberships: { orgId: "memberships.orgId" },
  organizations: { id: "organizations.id" },
  prChecks: { id: "prChecks.id" },
  repoKnowledge: { id: "repoKnowledge.id" },
  repoSettings: { id: "repoSettings.id" },
  repos: {
    id: "repos.id",
    fullName: "repos.fullName",
    installationId: "repos.installationId",
    ownerGithubId: "repos.ownerGithubId",
    owner: "repos.owner",
  },
  users: { id: "users.id" },
  getDb: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { enqueue } from "../src/queue";
import { enqueueRebuild } from "../src/services/dashboard";

const mockGetDb = vi.mocked(getDb);
const mockEnqueue = vi.mocked(enqueue);

function fakeDb() {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => [{ fullName: "acme/repo", instGh: 123 }],
          }),
        }),
      }),
    }),
  };
}

describe("enqueueRebuild flood protection (R5-143)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockImplementation(() => fakeDb() as never);
    mockEnqueue.mockResolvedValue("job-1");
  });

  it("enqueues extract with a per-repo singleton key", async () => {
    await enqueueRebuild("repo-123");
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const opts = mockEnqueue.mock.calls[0]?.[2] as unknown as {
      singletonKey?: string;
    };
    expect(opts?.singletonKey).toBeDefined();
    expect(opts?.singletonKey).toContain("repo-123");
  });

  it("reuses the same singleton key on repeated calls", async () => {
    await enqueueRebuild("repo-123");
    await enqueueRebuild("repo-123");
    const k1 = (mockEnqueue.mock.calls[0]?.[2] as unknown as { singletonKey?: string })?.singletonKey;
    const k2 = (mockEnqueue.mock.calls[1]?.[2] as unknown as { singletonKey?: string })?.singletonKey;
    expect(k1).toBeDefined();
    expect(k2).toBe(k1);
  });
});
