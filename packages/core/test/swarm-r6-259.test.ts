import { describe, it, expect, vi } from "vitest";
import * as graphService from "../src/graph/service";
import { contextForScope } from "../src/reasoning/context";

describe("R6-259: critical decision outside first 30 must not be dropped", () => {
  it("includes the critical decision in Engineering Context", async () => {
    const lows = Array.from({ length: 30 }, (_, i) => ({
      id: `low-${i}`,
      decision: `low decision ${i}`,
      why: "low why",
      importance: "low",
      status: "approved",
      evidence: [],
      confidence: 0.8,
      review: "unreviewed",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }));
    const critical = {
      id: "critical-1",
      decision: "critical governing decision",
      why: "critical why",
      importance: "critical",
      status: "approved",
      evidence: [],
      confidence: 0.9,
      review: "unreviewed",
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    };
    const all = [...lows, critical];
    const spy = vi
      .spyOn(graphService, "activeDecisionsForScope")
      .mockImplementation(async (repoId, scope, limit) => {
        const rows = all as unknown as Awaited<
          ReturnType<typeof graphService.activeDecisionsForScope>
        >;
        if (typeof limit === "number") return rows.slice(0, limit);
        return rows;
      });
    try {
      const ctx = await contextForScope("repo-1", {});
      expect(ctx.constraints.length).toBeLessThanOrEqual(30);
      expect(ctx.constraints.some((c) => c.decisionId === "critical-1")).toBe(true);
      expect(ctx.promptBlock).toContain("critical governing decision");
    } finally {
      spy.mockRestore();
    }
  });
});
