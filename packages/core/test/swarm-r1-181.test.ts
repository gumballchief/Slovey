import { describe, it, expect, vi } from "vitest";
import { canI } from "../src/api/can-i";
import { retrieveRanked } from "../src/reasoning/engine";
import { getAI } from "../src/ai";

vi.mock("../src/reasoning/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/reasoning/engine")>();
  return { ...actual, retrieveRanked: vi.fn() };
});

vi.mock("../src/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ai")>();
  return { ...actual, getAI: vi.fn() };
});

describe("R1-181 fractional citation index", () => {
  it("ignores non-integer used index instead of crashing", async () => {
    const fakeRow: any = { id: "d1", title: "t", decision: "Use Postgres", status: "approved", evidence: [], rejectionReason: null, alternatives: [] };
    vi.mocked(retrieveRanked).mockResolvedValue([{ row: fakeRow, distance: 0.1, freshness: 1, rank: 1 }] as any);
    vi.mocked(getAI).mockReturnValue({ completeJSON: async () => ({ verdict: "allowed", rationale: "ok", used: [1.5] }) } as any);
    const res = await canI("repo1", "Can I add Redis?");
    expect(res.citations).toEqual([]);
  });
});
