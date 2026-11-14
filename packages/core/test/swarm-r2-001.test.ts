import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 1, updated: 0 })),
}));

vi.mock("@company-brain/db", () => {
  const victimRow = {
    id: "victim-connector",
    repoId: "victim-repo",
    type: "slack",
    config: {},
    encryptedToken: "enc",
  };
  return {
    connectors: { id: "id", repoId: "repoId" },
    getDb: () => ({
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([victimRow]) }),
        }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    }),
  };
});

vi.mock("../src/crypto", () => ({ decryptSecret: () => "tok" }));

vi.mock("../src/connectors", () => ({
  isConnectorType: () => true,
  getConnectorClient: () => ({
    fetchDocs: async () => [
      { title: "Victim doc", content: "victim secret content", url: "https://example/victim" },
    ],
  }),
}));

vi.mock("../src/ai", () => ({
  getAI: () => ({
    completeJSON: async () => [
      { decision: "victim decision", why: "", examples: [], evidence: [], category: "other" },
    ],
  }),
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: hoisted.upsertDecisions,
}));

import { runIngestConnector } from "../src/pipelines/ingest-connector";

describe("R2-001 cross-tenant connector ingestion", () => {
  it("rejects a connector belonging to another repo", async () => {
    hoisted.upsertDecisions.mockClear();
    await expect(
      runIngestConnector({ repoId: "attacker-repo", connectorId: "victim-connector" }),
    ).rejects.toThrow();
    expect(hoisted.upsertDecisions).not.toHaveBeenCalled();
  });
});
