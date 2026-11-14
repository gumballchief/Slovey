import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => ({
  connectors: { id: "id", repoId: "repoId" },
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
}));

vi.mock("../src/connectors", () => ({
  getConnectorClient: vi.fn(),
  isConnectorType: vi.fn(() => true),
}));

vi.mock("../src/crypto", () => ({
  decryptSecret: vi.fn(() => "token"),
}));

vi.mock("../src/ai", () => ({
  getAI: vi.fn(),
}));

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { getAI } from "../src/ai";
import { getConnectorClient } from "../src/connectors";
import { runIngestConnector } from "../src/pipelines/ingest-connector";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

function setupDb(): void {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: "c1", repoId: "r1", type: "notion", config: {}, encryptedToken: "enc" },
          ],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => ({}),
      }),
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as unknown as never);
}

describe("ingest-connector per-doc isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("truncates huge docs and continues past a failing doc", async () => {
    setupDb();
    const docs = [
      { title: "huge page", content: "x".repeat(200000), url: "https://example.com/huge" },
      { title: "BAD-DOC", content: "small bad content", url: "https://example.com/bad" },
      { title: "good", content: "small good content", url: "https://example.com/good" },
    ];
    vi.mocked(getConnectorClient).mockReturnValue(
      { fetchDocs: async () => docs } as unknown as never,
    );
    const seen: string[] = [];
    vi.mocked(getAI).mockReturnValue(
      {
        completeJSON: async (prompt: string) => {
          seen.push(prompt);
          if (prompt.length > 20000) throw new Error("context overflow");
          if (prompt.includes("BAD-DOC")) throw new Error("bad doc boom");
          return [{ decision: "always do X", why: "", examples: [], evidence: ["PR #1"] }];
        },
      } as unknown as never,
    );
    vi.mocked(upsertDecisions).mockResolvedValue({ inserted: 2, updated: 0 });

    const result = await runIngestConnector({ repoId: "r1", connectorId: "c1" });

    expect(result.docs).toBe(3);
    expect(seen.length).toBe(3);
    for (const p of seen) expect(p.length).toBeLessThan(20000);
    expect(upsertDecisions).toHaveBeenCalledTimes(1);
    const items = vi.mocked(upsertDecisions).mock.calls[0][1] as unknown[];
    expect(items.length).toBe(2);
  });
});
