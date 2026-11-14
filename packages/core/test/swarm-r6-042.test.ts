import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setAI } from "../src/ai";
import { importDocs } from "../src/pipelines/import-docs";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 1, updated: 0 })),
}));

describe("R6-042 partial import on AI failure", () => {
  beforeEach(() => {
    vi.mocked(upsertDecisions).mockResolvedValue({ inserted: 1, updated: 0 });
  });
  afterEach(() => {
    setAI(null);
    vi.clearAllMocks();
  });

  it("continues past a per-doc throw and still upserts earlier decisions", async () => {
    let calls = 0;
    setAI({
      name: "fake",
      async complete() { return ""; },
      async completeJSON<T>(): Promise<T | null> {
        calls++;
        if (calls === 2) throw new Error("timeout");
        const one = [{ decision: `rule ${calls}`, why: "", examples: [], evidence: ["x"], category: "docs" }];
        return one as unknown as T;
      },
    });
    const result = await importDocs("repo-r6-042", [
      { path: "a.md", content: "doc a" },
      { path: "b.md", content: "doc b" },
      { path: "c.md", content: "doc c" },
    ]);
    expect(result.docs).toBe(3);
    expect(result.extracted).toBe(2);
    expect(upsertDecisions).toHaveBeenCalledOnce();
    expect(result.inserted).toBe(1);
  });
});
