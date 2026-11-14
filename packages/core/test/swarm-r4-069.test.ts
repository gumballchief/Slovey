import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => {
  const decisions = { id: "decisions.id", repoId: "decisions.repoId", decision: "decisions.decision" };
  const feedback = { repoId: "feedback.repoId", decisionId: "feedback.decisionId", action: "feedback.action" };
  const prChecks = { id: "prChecks.id", repoId: "prChecks.repoId", prNumber: "prChecks.prNumber", matchedDecisionId: "prChecks.matchedDecisionId", checkedAt: "prChecks.checkedAt" };
  const makeSelect = () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([]),
        }),
        limit: () => Promise.resolve([]),
      }),
    }),
  });
  const fakeDb = {
    select: () => makeSelect(),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: "fb1" }]),
      }),
    }),
  };
  return { getDb: vi.fn(() => fakeDb), decisions, feedback, prChecks };
});

vi.mock("../src/memory", () => ({
  reinforce: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: vi.fn(actual.eq), and: vi.fn(actual.and), desc: vi.fn(actual.desc) };
});

import { getDb, decisions } from "@company-brain/db";
import { reinforce } from "../src/memory";
import { eq } from "drizzle-orm";
import { recordFeedback, getDismissedNotes } from "../src/pipelines/feedback";

describe("R4-069 cross-tenant feedback scoping", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockClear();
    vi.mocked(reinforce).mockClear();
    vi.mocked(eq).mockClear();
  });

  it("rejects confirm with decision from another repo", async () => {
    await expect(
      recordFeedback({ repoId: "repo-A", decisionId: "victim-decision-in-repo-B", action: "confirm" })
    ).rejects.toThrow();
    expect(vi.mocked(reinforce).mock.calls.length).toBe(0);
  });

  it("scopes dismissed notes to the requesting repo", async () => {
    await getDismissedNotes("repo-A");
    const sawRepoScope = vi.mocked(eq).mock.calls.some((call) => call[0] === decisions.repoId && call[1] === "repo-A");
    expect(sawRepoScope).toBe(true);
  });
});
