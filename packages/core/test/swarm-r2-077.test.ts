import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const recordFeedback = vi.fn(async () => ({}));
  const getCollaboratorPermissionLevel = vi.fn();
  const pullsGet = vi.fn();
  const listReactions = vi.fn();
  const prChecks = { id: "pc-id", matchedDecisionId: "pc-matched", repoId: "pc-repo", prNumber: "pc-num", checkedAt: "pc-at" };
  const feedback = { id: "fb-id", prCheckId: "fb-check", byUser: "fb-user", action: "fb-action" };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => ({
            limit: async () =>
              table === prChecks ? [{ id: "check1", matched: "dec1" }] : [],
          }),
          limit: async () => [],
        }),
      }),
    }),
  };
  const octokit = {
    rest: {
      reactions: { listForIssueComment: listReactions },
      pulls: { get: pullsGet },
      repos: { getCollaboratorPermissionLevel },
    },
  };
  return { recordFeedback, getCollaboratorPermissionLevel, pullsGet, listReactions, prChecks, feedback, db, octokit };
});

vi.mock("@company-brain/db", () => ({ feedback: h.feedback, prChecks: h.prChecks, getDb: () => h.db }));
vi.mock("drizzle-orm", () => ({ and: (...a: unknown[]) => a, desc: (x: unknown) => x, eq: (...a: unknown[]) => a }));
vi.mock("../src/github/app", () => ({ getInstallationOctokit: async () => h.octokit }));
vi.mock("../src/github/fetchers", () => ({ findBotComment: async () => 999 }));
vi.mock("../src/pipelines/feedback", () => ({ recordFeedback: h.recordFeedback }));

import { pollReactionDismissals } from "../src/pipelines/reactions";

const params = { repoId: "repo1", installationId: 1, owner: "acme", name: "repo", prNumber: 7 };

beforeEach(() => {
  vi.clearAllMocks();
  h.pullsGet.mockResolvedValue({ data: { user: { login: "attacker" } } });
});

describe("reaction dismissals", () => {
  it("does not let the PR author dismiss their own blocking decision, even with write access", async () => {
    h.listReactions.mockResolvedValue({ data: [{ content: "-1", user: { login: "attacker", type: "User" } }] });
    h.getCollaboratorPermissionLevel.mockResolvedValue({ data: { permission: "write" } });
    const res = await pollReactionDismissals(params);
    expect(h.recordFeedback).not.toHaveBeenCalled();
    expect(res.recorded).toBe(0);
  });

  it("does not record dismissals from users without write/admin/maintain", async () => {
    h.listReactions.mockResolvedValue({ data: [{ content: "-1", user: { login: "outsider", type: "User" } }] });
    h.getCollaboratorPermissionLevel.mockResolvedValue({ data: { permission: "read" } });
    const res = await pollReactionDismissals(params);
    expect(h.recordFeedback).not.toHaveBeenCalled();
    expect(res.recorded).toBe(0);
  });

  it("still records dismissals from a non-author maintainer with write access", async () => {
    h.listReactions.mockResolvedValue({ data: [{ content: "-1", user: { login: "maintainer", type: "User" } }] });
    h.getCollaboratorPermissionLevel.mockResolvedValue({ data: { permission: "write" } });
    const res = await pollReactionDismissals(params);
    expect(h.recordFeedback).toHaveBeenCalledTimes(1);
    expect(res.recorded).toBe(1);
  });
});
