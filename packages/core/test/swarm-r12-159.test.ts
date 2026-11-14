import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@company-brain/db")>();
  return { ...orig, getDb: vi.fn() };
});

import { getDb } from "@company-brain/db";
import { setAI, type AIProvider } from "../src/ai";
import { setEmbeddings, type EmbeddingProvider } from "../src/embeddings";
import { reason } from "../src/reasoning/engine";

describe("L159 fractional citation index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fakeRow = {
      id: "d1",
      repoId: "repo-1",
      title: "Use Postgres",
      decision: "Use Postgres for storage",
      why: "reliable",
      evidence: ["pr-1"],
      status: "approved",
      importance: "high",
      confidence: 0.9,
      review: "confirmed",
      updatedAt: new Date(),
    };
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [{ row: fakeRow, distance: 0.1 }],
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [fakeRow],
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockImplementation(
      () => fakeDb as unknown as ReturnType<typeof getDb>,
    );
    const fakeEmbeddings = {
      embedOne: async () => [0.1, 0.2, 0.3],
      embedMany: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
    } as unknown as EmbeddingProvider;
    setEmbeddings(fakeEmbeddings);
    const fakeAI = {
      completeJSON: async () => ({
        answer: "Use Postgres [1].",
        used: [1.5],
        confidence: "high",
      }),
      complete: async () => "Use Postgres.",
    } as unknown as AIProvider;
    setAI(fakeAI);
  });

  it("does not throw on fractional used index", async () => {
    const ans = await reason("repo-1", "What DB should we use?");
    expect(ans.citations).toEqual([]);
    expect(ans.confidence).toBe("low");
    expect(ans.answer).toContain("Postgres");
  });
});
