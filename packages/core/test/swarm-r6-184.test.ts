import { vi, describe, it, expect } from "vitest";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  decisions: { id: "id", decision: "decision", repoId: "repoId" },
  feedback: {},
  prChecks: { id: "id", matchedDecisionId: "matchedDecisionId", repoId: "repoId", prNumber: "prNumber", checkedAt: "checkedAt" },
}));

vi.mock("../src/memory", () => ({
  reinforce: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { recordFeedback } from "../src/pipelines/feedback";

function makeDb(matched: string | null) {
  let inserted: { decisionId?: unknown } | null = null;
  const row = { id: "check-1", matched };
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [row],
          }),
          limit: async () => [row],
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => {
        inserted = v;
        return { returning: async () => [{ ...v, id: "fb-1" }] };
      },
    })),
  };
  return { db, getInserted: () => inserted as unknown as { decisionId: string | null } };
}

describe("R6-184 explicit prCheckId derives decision", () => {
  it("populates decisionId from prChecks.matchedDecisionId", async () => {
    const { db, getInserted } = makeDb("dec-123");
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    await recordFeedback({ repoId: "r1", prCheckId: "check-1", action: "dismiss" });
    expect(getInserted().decisionId).toBe("dec-123");
  });
});
