import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchDecisions } from "../src/services/dashboard";

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [0.1, 0.2, 0.3] }),
}));

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return {
    ...orig,
    getDb: () => (globalThis as unknown as { __fakeDb: unknown }).__fakeDb,
  };
});

function installFakeDb() {
  const store = { selectArg: undefined as unknown, limit: undefined as unknown, seen: false };
  (globalThis as unknown as { __capture: typeof store }).__capture = store;
  (globalThis as unknown as { __fakeDb: unknown }).__fakeDb = {
    select: (...args: unknown[]) => {
      store.seen = true;
      store.selectArg = args.length === 0 ? undefined : args[0];
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: (n: number) => {
                store.limit = n;
                return Promise.resolve([]);
              },
            }),
          }),
        }),
      };
    },
  };
}

describe("R7-183 searchDecisions resource exhaustion", () => {
  beforeEach(() => {
    installFakeDb();
  });

  it("caps caller limit and does not select embedding vectors", async () => {
    await searchDecisions("repo-1", "hello", 1000000);
    const cap = (globalThis as unknown as { __capture: { selectArg: unknown; limit: unknown } }).__capture;
    expect(cap.limit).toBeLessThanOrEqual(50);
    expect(cap.selectArg).toBeDefined();
    const keys = Object.keys((cap.selectArg ?? {}) as Record<string, unknown>);
    expect(keys).not.toContain("embedding");
    expect(keys).toEqual(expect.arrayContaining(["id", "decision", "why"]));
  });
});
