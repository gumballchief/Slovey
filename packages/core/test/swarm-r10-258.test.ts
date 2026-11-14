import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  users: { githubId: "mock-github-id" } as never,
  getDb: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { upsertUser } from "../src/services/users";

function mockDb(captured: { set?: Record<string, unknown> }) {
  return {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: (args: { set: Record<string, unknown> }) => {
          captured.set = args.set;
          return {
            returning: async () => [{ id: "1" }],
          };
        },
      }),
    }),
  } as never;
}

describe("upsertUser preserves stored email", () => {
  it("does not overwrite email with null when no email supplied", async () => {
    const captured: { set?: Record<string, unknown> } = {};
    vi.mocked(getDb).mockReturnValue(mockDb(captured));
    await upsertUser({ githubId: 123, login: "alice" });
    expect(captured.set).toBeDefined();
    expect(captured.set?.["email"]).not.toBeNull();
  });

  it("does not overwrite avatar with null when omitted", async () => {
    const captured: { set?: Record<string, unknown> } = {};
    vi.mocked(getDb).mockReturnValue(mockDb(captured));
    await upsertUser({ githubId: 123, login: "alice", email: null, avatarUrl: null });
    expect(captured.set?.["email"]).not.toBeNull();
    expect(captured.set?.["avatarUrl"]).not.toBeNull();
  });

  it("updates email when one is supplied", async () => {
    const captured: { set?: Record<string, unknown> } = {};
    vi.mocked(getDb).mockReturnValue(mockDb(captured));
    await upsertUser({ githubId: 123, login: "alice", email: "a@example.com" });
    expect(captured.set?.["email"]).toBe("a@example.com");
  });
});
