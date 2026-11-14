import { describe, it, expect, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  and: (...args: any[]) => args,
  eq: (...args: any[]) => args,
  gt: (...args: any[]) => args,
  isNull: (...args: any[]) => args,
  like: (...args: any[]) => args,
  or: (...args: any[]) => args,
  sql: (strings: any, ...values: any[]) => ({}),
}));

vi.mock("@company-brain/db", () => ({
  decisions: { id: {}, repoId: {}, decision: {} },
  preflightOverrides: {
    id: {},
    repoId: {},
    decisionId: {},
    grantedBy: {},
    reason: {},
    branch: {},
    expiresAt: {},
  },
  getDb: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { getActiveOverrides } from "../src/preflight/overrides";

function mockRows(rows: any[]) {
  (getDb as any).mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  });
}

describe("R2-107 branch-scoped override", () => {
  it("does not apply branch-scoped override when branch is unknown", async () => {
    mockRows([
      { decisionId: "scoped", grantedBy: "alice", reason: "temp", branch: "feature/x", expiresAt: null },
      { decisionId: "global", grantedBy: "bob", reason: "perm", branch: null, expiresAt: null },
    ]);
    const map = await getActiveOverrides("repo1", null);
    expect(map.has("global")).toBe(true);
    expect(map.has("scoped")).toBe(false);
    expect(map.size).toBe(1);
  });
});
