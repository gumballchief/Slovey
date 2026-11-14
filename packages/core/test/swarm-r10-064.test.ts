import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => {
  const state = { captured: null as null | Record<string, unknown> };
  const fakeDb = {
    _state: state,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "12345678-1111-2222-3333-444444444444", decision: "test decision" }],
        }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.captured = v;
        return { returning: async () => [{ id: "override-1" }] };
      },
    }),
  };
  return {
    decisions: { id: "id", decision: "decision", repoId: "repoId" },
    preflightOverrides: { id: "id" },
    getDb: () => fakeDb,
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (...args: unknown[]) => ({ eq: args }),
  gt: (...args: unknown[]) => ({ gt: args }),
  isNull: (...args: unknown[]) => ({ isNull: args }),
  like: (...args: unknown[]) => ({ like: args }),
  or: (...args: unknown[]) => ({ or: args }),
  sql: (parts: unknown, ...rest: unknown[]) => ({ parts, rest }),
}));

import { getDb } from "@company-brain/db";
import { createOverride } from "../src/preflight/overrides";

function capturedExpiresAt(): Date | null | undefined {
  const db = getDb() as unknown as { _state: { captured: { expiresAt: Date | null } | null } };
  return db._state.captured?.expiresAt;
}

const base = {
  repoId: "repo-1",
  decisionIdOrPrefix: "12345678",
  reason: "one-off",
  grantedBy: "alice",
};

describe("R10-064 default override expiry", () => {
  it("defaults missing hours to ~168h (one week) instead of null", async () => {
    const before = Date.now();
    const res = await createOverride({ ...base });
    expect(res.expiresAt).not.toBeNull();
    const exp = res.expiresAt as unknown as Date;
    expect(exp instanceof Date).toBe(true);
    const ms = exp.getTime() - before;
    expect(ms).toBeGreaterThan(167 * 3_600_000);
    expect(ms).toBeLessThanOrEqual(169 * 3_600_000);
    expect(capturedExpiresAt()).not.toBeNull();
  });

  it("defaults hours=0 and negative hours to ~168h (one week)", async () => {
    for (const hours of [0, -5]) {
      const before = Date.now();
      const res = await createOverride({ ...base, hours });
      expect(res.expiresAt).not.toBeNull();
      const ms = (res.expiresAt as unknown as Date).getTime() - before;
      expect(ms).toBeGreaterThan(167 * 3_600_000);
      expect(ms).toBeLessThanOrEqual(169 * 3_600_000);
    }
  });

  it("honours explicit positive hours", async () => {
    const before = Date.now();
    const res = await createOverride({ ...base, hours: 2 });
    const ms = (res.expiresAt as unknown as Date).getTime() - before;
    expect(ms).toBeGreaterThan(1.9 * 3_600_000);
    expect(ms).toBeLessThanOrEqual(2.1 * 3_600_000);
  });
});
