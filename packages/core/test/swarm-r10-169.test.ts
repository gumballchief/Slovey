import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const raw: string[] = [
    ...Array.from({ length: 20 }, () => "Decision A"),
    ...Array.from({ length: 20 }, (_, i) => `Decision ${String.fromCharCode(66 + i)}`),
  ];
  function builder(distinct: boolean) {
    const b: Record<string, unknown> = {};
    b.from = () => b;
    b.innerJoin = () => b;
    b.where = () => b;
    b.limit = (n: number) => {
      const source = distinct ? [...new Set(raw)] : raw;
      return Promise.resolve(source.slice(0, n).map((decision) => ({ decision })));
    };
    return b;
  }
  return { raw, builder };
});

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...args: unknown[]) => ({ args }),
  desc: (a: unknown) => a,
}));

vi.mock("../src/memory", () => ({ reinforce: vi.fn(async () => {}) }));

vi.mock("@company-brain/db", () => ({
  decisions: { id: "decisions.id", decision: "decisions.decision", repoId: "decisions.repoId" },
  feedback: { repoId: "feedback.repoId", action: "feedback.action", decisionId: "feedback.decisionId" },
  prChecks: { id: "prChecks.id", matchedDecisionId: "prChecks.matched", repoId: "prChecks.repoId", prNumber: "prChecks.prNumber", checkedAt: "prChecks.checkedAt" },
  getDb: () => ({
    select: () => hoisted.builder(false),
    selectDistinct: () => hoisted.builder(true),
  }),
}));

import { getDismissedNotes } from "../src/pipelines/feedback";

describe("R10-169 dismissed notes dedup before limit", () => {
  it("returns distinct decisions beyond the first 20 raw dismiss rows", async () => {
    const notes = await getDismissedNotes("repo-1");
    expect(notes).toHaveLength(20);
    expect(notes[0]).toBe("Decision A");
    expect(notes).toContain("Decision B");
    expect(notes).toContain("Decision S");
  });
});
