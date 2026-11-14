import { describe, it, expect, vi, afterEach } from "vitest";
import { canI } from "../src/api/can-i";
import { setAI } from "../src/ai";
import * as engine from "../src/reasoning/engine";

afterEach(() => {
  vi.restoreAllMocks();
  setAI(null);
});

describe("R3-240: forbidden decision past top-6 must be considered", () => {
  it("surfaces rejected precedent ranked at 7", async () => {
    const forbidden = "Do NOT use Redis for sessions";
    const mk = (i: number, decision: string, status: "approved" | "rejected", distance: number, rank: number): any => ({
      row: {
        id: `d${i}`,
        title: decision.slice(0, 20),
        decision,
        status,
        rejectionReason: status === "rejected" ? "tried and caused outage" : null,
        alternatives: status === "rejected" ? ["use Postgres"] : [],
        evidence: [],
      },
      distance,
      freshness: 0.5,
      rank,
    });
    const ranked = [
      mk(1, "Use Redis for cache is fine", "approved", 0.1, 0.9),
      mk(2, "Use Redis for cache is fine 2", "approved", 0.2, 0.89),
      mk(3, "Use Redis for cache is fine 3", "approved", 0.2, 0.88),
      mk(4, "Use Redis for cache is fine 4", "approved", 0.2, 0.87),
      mk(5, "Use Redis for cache is fine 5", "approved", 0.2, 0.86),
      mk(6, "Use Redis for cache is fine 6", "approved", 0.2, 0.85),
      mk(7, forbidden, "rejected", 0.15, 0.5),
      mk(8, "Unrelated perf note", "approved", 0.2, 0.4),
    ];
    vi.spyOn(engine, "retrieveRanked").mockResolvedValue(ranked);
    let prompt = "";
    setAI({
      completeJSON: async (data: string) => {
        prompt = data;
        return { verdict: "disallowed", rationale: "forbidden [7]", used: [7] };
      },
    } as any);
    const res = await canI("repo1", "Can I add Redis for sessions?");
    expect(res.rejectedPrecedent.map((r) => r.decision)).toContain(forbidden);
    expect(prompt).toContain(forbidden);
  });
});
