import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAI } from "../src/ai";
import { importDocs } from "../src/pipelines/import-docs";
import { upsertDecisions } from "../src/pipelines/upsert-decisions";

vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn(async () => ({ inserted: 1, updated: 0 })),
}));

describe("R2-071 negative headroom clamp", () => {
  beforeEach(() => {
    vi.mocked(upsertDecisions).mockClear();
    setAI({
      name: "fake",
      complete: async () => "[]",
      completeJSON: async () => [
        { decision: "Use postgres", why: "r", examples: ["ex"], evidence: ["a.md"], category: "database" },
      ],
    } as any);
  });

  it("does not upsert when headroom is negative (over limit)", async () => {
    const planLimit = 2;
    const currentCount = 5;
    const headroom = planLimit - currentCount; // -3
    const res = await importDocs("repo1", [{ path: "a.md", content: "hello" }], headroom);
    expect(headroom).toBeLessThan(0);
    expect(upsertDecisions).not.toHaveBeenCalled();
    expect(res.inserted).toBe(0);
    expect(res.updated).toBe(0);
    setAI(null);
  });
});
