import { describe, it, expect, vi } from "vitest";

vi.mock("../src/pipelines/retrieve", () => ({
  retrieveDecisions: vi.fn(),
}));

vi.mock("../src/ai", () => ({
  getAI: vi.fn(),
  setAI: vi.fn(),
}));

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  decisions: {
    id: "id",
    decision: "decision",
    evidence: "evidence",
    title: "title",
    repoId: "repoId",
    status: "status",
    embedding: "embedding",
  },
}));

import { getAI } from "../src/ai";
import { getDb } from "@company-brain/db";
import { retrieveDecisions } from "../src/pipelines/retrieve";
import { runDecisionCheck } from "../src/preflight/decisions";

describe("R11-099 partial retrieval failure must stay unverified", () => {
  it("warns when rejected query fails but relevant retrieval succeeds", async () => {
    vi.mocked(retrieveDecisions).mockResolvedValue([
      {
        id: "d1",
        decision: "Always validate input with zod schemas.",
        why: "why",
        examples: [],
        evidence: [],
        category: null,
        distance: 0.1,
      },
    ]);
    const failingLimit = () => Promise.reject(new Error("db timeout"));
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: failingLimit,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);
    vi.mocked(getAI).mockReturnValue({
      completeJSON: async () => ({ violations: [] }),
    } as unknown as ReturnType<typeof getAI>);

    const result = await runDecisionCheck("repo-1", "feat: add input handling", ["src/a.ts"]);
    expect(result.violations).toEqual([]);
    expect(result.note ?? "").toContain("Decision store unavailable");
  });
});
