import { describe, expect, it, vi } from "vitest";

const aiControl = vi.hoisted(() => ({
  failMidStream: true,
}));

vi.mock("@company-brain/db", () => ({
  decisions: {
    id: "id",
    repoId: "repoId",
    embedding: "embedding",
    status: "status",
    review: "review",
    evidence: "evidence",
  },
  decisionEdges: {},
  decisionVersions: {},
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [
              {
                row: {
                  id: "d1",
                  title: "Use Postgres",
                  decision: "Use Postgres",
                  why: "reliable",
                  evidence: [],
                  status: "approved",
                  importance: "high",
                  confidence: 0.9,
                  review: "confirmed",
                  updatedAt: new Date(),
                },
                distance: 0.1,
              },
            ],
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("drizzle-orm", () => ({
  and: (..._args: unknown[]) => ({}),
  desc: (..._args: unknown[]) => ({}),
  eq: (..._args: unknown[]) => ({}),
  getTableColumns: (..._args: unknown[]) => ({}),
  inArray: (..._args: unknown[]) => ({}),
  or: (..._args: unknown[]) => ({}),
  sql: (..._args: unknown[]) => ({}),
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => [0.1, 0.2, 0.3],
    embedMany: async () => [[0.1, 0.2, 0.3]],
  }),
  setEmbeddings: () => undefined,
}));

vi.mock("../src/ai", () => ({
  getAI: () => ({
    complete: async () => "fallback",
    completeJSON: async () => ({}),
    completeStream: async function* () {
      yield "Use Postgres [1] for storage";
      if (aiControl.failMidStream) throw new Error("rate limit reset mid-stream");
      yield " and more";
    },
  }),
  setAI: () => undefined,
}));

vi.mock("../src/memory/reinforce", () => ({
  reinforce: async () => null,
}));

import { reasonStream } from "../src/reasoning/engine";

describe("R6-261 truncated stream is not reported as complete success", () => {
  it("downgrades mid-stream failure to low confidence with truncation note", async () => {
    aiControl.failMidStream = true;
    const events = [];
    for await (const e of reasonStream("repo1", "where do we store data?")) {
      events.push(e);
    }
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    if (done?.type !== "done") return;
    expect(done.answer.answer.length).toBeGreaterThan(0);
    expect(done.answer.confidence).toBe("low");
    expect(done.answer.reasoning.join(" ")).toMatch(/truncat|incomplete/i);
  });
});
