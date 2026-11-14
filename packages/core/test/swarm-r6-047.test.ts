import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("drizzle-orm", () => ({ eq: (...args: unknown[]) => ({ args }) }));

vi.mock("@company-brain/db", () => ({
  connectors: { id: "id", repoId: "repoId", type: "type", config: "config", encryptedToken: "encryptedToken" },
  getDb: vi.fn(),
}));

vi.mock("../src/crypto", () => ({ decryptSecret: vi.fn(() => "token") }));

vi.mock("../src/connectors", () => ({
  isConnectorType: vi.fn(() => true),
  getConnectorClient: vi.fn(),
}));

vi.mock("../src/ai", () => ({ getAI: vi.fn() }));
vi.mock("../src/ai/prompts", () => ({ extractPrompt: (s: string) => s }));
vi.mock("../src/pipelines/upsert-decisions", () => ({ upsertDecisions: vi.fn() }));

import { getDb } from "@company-brain/db";
import { getAI } from "../src/ai";
import { getConnectorClient } from "../src/connectors";
import { runIngestConnector } from "../src/pipelines/ingest-connector";

const connectorRow = { id: "c1", repoId: "r1", type: "notion", config: {}, encryptedToken: "enc" };
let statusUpdates: Array<Record<string, unknown>> = [];

function installFakes() {
  statusUpdates = [];
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [connectorRow],
        }),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: async () => {
          statusUpdates.push(vals);
          return [];
        },
      }),
    }),
  };
  vi.mocked(getDb).mockReturnValue(fakeDb as never);
  vi.mocked(getConnectorClient).mockReturnValue({
    fetchDocs: async () => [
      { title: "D1", content: "decision content one", url: "https://x/1" },
      { title: "D2", content: "decision content two", url: "https://x/2" },
    ],
  } as never);
  vi.mocked(getAI).mockReturnValue({
    completeJSON: async () => null,
    complete: async () => "",
    name: "fake",
  } as never);
}

-describe("ingest-connector extraction outage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakes();
  });

  it("does not report connected success when every extraction fails", async () => {
    try {
      await runIngestConnector({ repoId: "r1", connectorId: "c1" });
    } catch {
      // throwing is acceptable; status must still be error
    }
    const hasError = statusUpdates.some((u) => u.status === "error" && typeof u.lastError === "string" && (u.lastError as string).length > 0);
    expect(hasError).toBe(true);
  });
});
