import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reinforce: vi.fn(),
  insertValues: vi.fn(),
  decisionRows: new Array<{ id: string }>(),
}));

vi.mock("../src/memory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/memory")>();
  return {
    ...actual,
    reinforce: (...args: unknown[]) => mocks.reinforce(...args),
  };
});

vi.mock("../src/queue", () => ({
  enqueue: vi.fn(),
  JOBS: { extract: "extract" },
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({ embedOne: async () => [] }),
}));

vi.mock("@company-brain/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@company-brain/db")>();
  const selectStub = () => ({
    from: (table: unknown) => ({
      where: (..._w: unknown[]) => ({
        orderBy: (..._o: unknown[]) => ({
          limit: async (..._l: unknown[]) => {
            if (table === actual.decisions) return mocks.decisionRows;
            return [];
          },
        }),
        limit: async (..._l: unknown[]) => {
          if (table === actual.decisions) return mocks.decisionRows;
          return [];
        },
      }),
    }),
  });
  const mockDb = {
    select: selectStub,
    insert: (_t: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        mocks.insertValues(vals);
        return {
          returning: async () => [{ id: "fb-1", ...vals }],
        };
      },
    }),
  };
  return { ...actual, getDb: () => mockDb };
});

import { dashboardFeedback } from "../src/services/dashboard";

beforeEach(() => {
  mocks.reinforce.mockClear();
  mocks.insertValues.mockClear();
  mocks.decisionRows.length = 0;
});

describe("dashboardFeedback tenant isolation (R7-178)", () => {
  it("rejects feedback for a decision from another repo", async () => {
    await expect(
      dashboardFeedback("repo-A", {
        prNumber: 1,
        decisionId: "decision-victim",
        action: "confirm",
      }),
    ).rejects.toThrow();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.reinforce).not.toHaveBeenCalled();
  });

  it("accepts feedback for a decision in the same repo", async () => {
    mocks.decisionRows.push({ id: "decision-own" });
    const row = await dashboardFeedback("repo-A", {
      prNumber: 1,
      decisionId: "decision-own",
      action: "confirm",
    });
    expect(row).toBeDefined();
    expect(mocks.insertValues).toHaveBeenCalled();
    expect(mocks.reinforce).toHaveBeenCalledWith("repo-A", "decision-own", "confirmed");
  });
});
