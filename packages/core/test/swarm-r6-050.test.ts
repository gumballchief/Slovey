import { describe, expect, it, vi } from "vitest";

vi.mock("../src/github/app", () => ({
  getInstallationOctokit: vi.fn(),
}));
vi.mock("../src/github/fetchers", () => ({
  findBotComment: vi.fn(),
}));
vi.mock("../src/pipelines/feedback", () => ({
  recordFeedback: vi.fn(),
}));
vi.mock("@company-brain/db", () => ({
  feedback: {},
  prChecks: {},
  getDb: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { getInstallationOctokit } from "../src/github/app";
import { findBotComment } from "../src/github/fetchers";
import { recordFeedback } from "../src/pipelines/feedback";
import { pollReactionDismissals } from "../src/pipelines/reactions";

describe("R6-050: PR author fetch failure must fail closed", () => {
  it("does not record the author's own downvote when pulls.get fails", async () => {
    const now = Date.now();
    const checkRow = {
      id: "check-1",
      matched: null,
      checkedAt: new Date(now - 10_000),
    };
    const freshReaction = {
      content: "-1",
      created_at: new Date(now + 10_000).toISOString(),
      author_association: "MEMBER",
      user: { login: "prAuthor", type: "User" },
    };
    const octokit = {
      rest: {
        reactions: {
          listForIssueComment: vi.fn().mockResolvedValue({ data: [freshReaction] }),
        },
        pulls: {
          get: vi.fn().mockRejectedValue(new Error("rate limited")),
        },
        repos: {
          getCollaboratorPermissionLevel: vi
            .fn()
            .mockResolvedValue({ data: { permission: "write" } }),
        },
      },
    };
    vi.mocked(getInstallationOctokit).mockResolvedValue(
      octokit as unknown as Awaited<ReturnType<typeof getInstallationOctokit>>,
    );
    vi.mocked(findBotComment).mockResolvedValue(999);
    let limitCalls = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              limitCalls += 1;
              return limitCalls === 1 ? [checkRow] : [];
            },
          }),
          limit: async () => {
            limitCalls += 1;
            return limitCalls === 1 ? [checkRow] : [];
          },
        }),
      }),
    }));
    vi.mocked(getDb).mockReturnValue({ select: selectMock } as unknown as ReturnType<typeof getDb>);
    vi.mocked(recordFeedback).mockResolvedValue({} as Awaited<ReturnType<typeof recordFeedback>>);

    const result = await pollReactionDismissals({
      repoId: "r1",
      installationId: 1,
      owner: "o",
      name: "n",
      prNumber: 7,
    });

    expect(result.recorded).toBe(0);
    expect(recordFeedback).not.toHaveBeenCalled();
  });
});
