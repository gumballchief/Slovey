import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordFeedback: vi.fn(),
  getDb: vi.fn(),
  getInstallationOctokit: vi.fn(),
  findBotComment: vi.fn(),
}));

vi.mock("@company-brain/db", () => ({
  getDb: mocks.getDb,
  feedback: { id: "id", prCheckId: "prCheckId", byUser: "byUser", action: "action" },
  prChecks: { id: "id", matchedDecisionId: "matched", checkedAt: "checkedAt", repoId: "repoId", prNumber: "prNumber" },
}));
vi.mock("drizzle-orm", () => ({ and: () => ({}), desc: () => ({}), eq: () => ({}) }));
vi.mock("../src/github/app", () => ({ getInstallationOctokit: mocks.getInstallationOctokit }));
vi.mock("../src/github/fetchers", () => ({ findBotComment: mocks.findBotComment }));
vi.mock("../src/pipelines/feedback", () => ({ recordFeedback: mocks.recordFeedback }));

import { pollReactionDismissals } from "../src/pipelines/reactions";

describe("pollReactionDismissals poisoned downvoter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips a downvoter whose recordFeedback throws and still records the next", async () => {
    const check = { id: "check1", matched: "dec1", checkedAt: new Date("2024-01-01T00:00:00Z") };
    const queue: unknown[][] = [[check], [], []];
    mocks.getDb.mockImplementation(() => ({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => queue.shift() ?? [] }),
            limit: async () => queue.shift() ?? [],
          }),
        }),
      }),
    }));
    mocks.findBotComment.mockResolvedValue(123);
    mocks.getInstallationOctokit.mockResolvedValue({
      rest: {
        reactions: {
          listForIssueComment: async () => ({
            data: [
              { content: "-1", user: { login: "alice", type: "User" }, author_association: "MEMBER", created_at: "2024-01-02T00:00:00Z" },
              { content: "-1", user: { login: "bob", type: "User" }, author_association: "MEMBER", created_at: "2024-01-02T00:00:00Z" },
            ],
          }),
        },
        pulls: { get: async () => ({ data: { user: { login: "author" } } }) },
        repos: { getCollaboratorPermissionLevel: async () => ({ data: { permission: "write" } }) },
      },
    });
    mocks.recordFeedback.mockRejectedValueOnce(new Error("decision deleted")).mockResolvedValueOnce({});

    const result = await pollReactionDismissals({ repoId: "r1", installationId: 1, owner: "o", name: "n", prNumber: 7 });
    expect(result).toEqual({ recorded: 1 });
    expect(mocks.recordFeedback).toHaveBeenCalledTimes(2);
  });
});
