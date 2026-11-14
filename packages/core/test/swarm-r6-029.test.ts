import { describe, expect, it, vi } from "vitest";

const captured: unknown[] = [];
const mockExecute = vi.fn(async (query: unknown) => {
  captured.push(query);
  return [];
});

function emptyChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  };
  return chain;
}

const mockDb = {
  select: () => emptyChain(),
  execute: mockExecute,
};

vi.mock("@company-brain/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@company-brain/db")>();
  return { ...actual, getDb: () => mockDb };
});

vi.mock("../src/graph/governance", () => ({
  governanceReport: async () => ({
    totalActive: 0,
    counts: {},
    stale: [],
    orphaned: [],
    needsReview: [],
    conflicts: [],
  }),
}));

import { memoryHealth } from "../src/memory/health";

/** Collect SQL text without JSON-stringifying Drizzle objects (circular). */
function sqlText(node: unknown, seen = new Set<object>(), out: string[] = []): string {
  if (typeof node === "string") {
    out.push(node);
    return out.join(" ");
  }
  if (!node || typeof node !== "object") return out.join(" ");
  if (seen.has(node)) return out.join(" ");
  seen.add(node);
  const values = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
  for (const value of values) sqlText(value, seen, out);
  return out.join(" ");
}

describe("R6-029 bounded LATERAL duplicate scan", () => {
  it("uses a bounded LATERAL KNN scan and caches per repo", async () => {
    await memoryHealth("repo-r6-029");
    await memoryHealth("repo-r6-029");
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    const text = sqlText(captured[0]);
    expect(text).toMatch(/LATERAL/i);
    expect(text).toMatch(/<=>/);
    expect(text).toMatch(/LIMIT/i);
    expect(text).not.toMatch(/INNER JOIN/i);
  });
});
