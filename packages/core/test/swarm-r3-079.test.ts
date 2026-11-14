import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setAI } from "../src/ai";
import { importDocs } from "../src/pipelines/import-docs";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(),
}));

describe("R3-079 org cap across repos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAI({
      name: "test",
      complete: async () => "",
      completeJSON: async () =>
        Array.from({ length: 10 }, (_, i) => ({
          decision: `decision ${i}`,
          why: "",
          examples: [],
          evidence: ["PR #1"],
          category: "docs",
        })),
    } as any);
    (upsertDecisions as any).mockImplementation(async (_repoId: string, items: any[]) => ({
      inserted: items.length,
      updated: 0,
    }));
  });
  afterEach(() => {
    setAI(null);
  });
  it("concurrent imports in different repos of same org share headroom", async () => {
    const docs = [{ path: "a.md", content: "# hello content here" }];
    const call = importDocs as any;
    const [r1, r2] = await Promise.all([
      call("repoA", docs, 10, "org-1"),
      call("repoB", docs, 10, "org-1"),
    ]);
    const total = (r1.inserted ?? 0) + (r2.inserted ?? 0);
    expect(total).toBeLessThanOrEqual(10);
  });
});
