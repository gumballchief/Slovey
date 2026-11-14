import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => ({
  connectors: { repoId: "repoId", type: "type" },
  getDb: vi.fn(),
}));

vi.mock("../src/crypto", () => ({
  encryptSecret: (s: string) => `enc:${s}`,
}));

import { getDb } from "@company-brain/db";
import { saveConnector } from "../src/services/connectors";

function mockDbCapture(captured: { set?: Record<string, unknown> }) {
  const fakeDb = {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: (args: { set: Record<string, unknown> }) => {
          captured.set = args.set;
          return {
            returning: async () => [
              { id: "id1", type: "slack", status: "connected", lastSyncedAt: null, lastError: null },
            ],
          };
        },
      }),
    }),
  };
  const mockedGetDb = getDb as unknown as { mockReturnValue: (v: unknown) => void };
  mockedGetDb.mockReturnValue(fakeDb);
}

describe("R6-267 reconnect without config preserves stored config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits config from conflict-update when config is undefined", async () => {
    const captured: { set?: Record<string, unknown> } = {};
    mockDbCapture(captured);
    await saveConnector("repo1", "slack", "new-token");
    expect(captured.set).toBeDefined();
    expect(captured.set).not.toHaveProperty("config");
    expect(captured.set).toHaveProperty("encryptedToken");
    expect(captured.set).toHaveProperty("status", "connected");
  });

  it("overwrites config when config is provided", async () => {
    const captured: { set?: Record<string, unknown> } = {};
    mockDbCapture(captured);
    await saveConnector("repo1", "slack", "new-token", {});
    expect(captured.set).toBeDefined();
    expect(captured.set).toHaveProperty("config");
  });
});
