import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAI } from "../src/ai";
import { importDocs } from "../src/pipelines/import-docs";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async (_repoId: string, items: unknown[]) => ({
    inserted: items.length,
    updated: 0,
  })),
}));

const mockUpsert = vi.mocked(upsertDecisions);

function totalUpserted(): number {
  return mockUpsert.mock.calls.reduce((sum, call) => sum + (call[1] as unknown[]).length, 0);
}

beforeEach(() => {
  mockUpsert.mockClear();
  setAI({
    name: "fake",
    complete: async () => "",
    completeJSON: async () => {
      await new Promise((r) => setTimeout(r, 20));
      return Array.from({ length: 5 }, (_, i) => ({
        decision: `Decision ${i}`,
        why: "why",
        examples: [],
        evidence: ["a.md"],
      }));
    },
  } as never);
});

describe("importDocs plan headroom race", () => {
  it("concurrent imports for one repo collectively respect maxNew", async () => {
    await Promise.all([
      importDocs("repo-1", [{ path: "a.md", content: "alpha" }], 5),
      importDocs("repo-1", [{ path: "b.md", content: "beta" }], 5),
    ]);
    expect(totalUpserted()).toBeLessThanOrEqual(5);
  });
});
