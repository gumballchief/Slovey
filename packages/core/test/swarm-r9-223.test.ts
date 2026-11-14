import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  llmResult: new Array<unknown>(),
  upsertItems: new Array<unknown>(),
}));

vi.mock("@company-brain/db", () => {
  const row = { id: "c1", repoId: "r1", type: "notion", config: {}, encryptedToken: "blob" };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [row] }) }) }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  };
  return { connectors: { id: "id", repoId: "repoId", type: "type" }, getDb: () => db };
});

vi.mock("../src/ai", () => ({
  getAI: () => ({
    completeJSON: async () => store.llmResult,
  }),
}));

vi.mock("../src/connectors", () => ({
  isConnectorType: () => true,
  getConnectorClient: () => ({
    fetchDocs: async () => [{ content: "hello world", title: "Doc", url: "https://example.com/doc" }],
  }),
}));

vi.mock("../src/crypto", () => ({
  decryptSecret: () => "token",
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: async (_repoId: string, items: Array<unknown>) => {
    for (const item of items) store.upsertItems.push(item);
    return { inserted: items.length, updated: 0 };
  },
}));

import { runIngestConnector } from "../src/pipelines/ingest-connector";

describe("ingest-connector null element", () => {
  it("skips null element instead of aborting the batch", async () => {
    store.llmResult.length = 0;
    store.llmResult.push(null, {
      decision: "Use Postgres for durable state",
      why: "discussed",
      examples: [],
      evidence: [],
      category: "database",
    });
    store.upsertItems.length = 0;
    const result = await runIngestConnector({ repoId: "r1", connectorId: "c1" });
    expect(result.docs).toBe(1);
    expect(store.upsertItems.length).toBe(1);
  });
});
