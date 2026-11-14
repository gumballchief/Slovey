import { describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  updatePayload: null as Record<string, unknown> | null,
  near: {
    id: "near-id",
    evidence: ["old-evidence"],
    examples: ["old-example"],
    review: "unreviewed",
    source: "github_pr",
    distance: 0.01,
  },
}));

vi.mock("../src/embeddings", () => ({
  getEmbeddings: () => ({
    embedOne: async () => [0.1, 0.2, 0.3],
  }),
}));

vi.mock("../src/graph/service", () => ({
  activeDecisionsForScope: async () => [],
  addEdge: async () => undefined,
}));

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;
  const selectChain = {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => [ctx.near],
        }),
      }),
    }),
  };
  const mockDb = {
    select: () => selectChain,
    update: () => ({
      set: (payload: Record<string, unknown>) => ({
        where: async () => {
          ctx.updatePayload = payload;
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: "new-id" }],
      }),
    }),
  };
  return { ...orig, getDb: () => mockDb };
});

import { upsertDecisions } from "../src/pipelines/upsert-decisions";
import { extractScope } from "../src/planning/classify";

describe("R10-197 empty scope must not wipe decision scope", () => {
  it("preserves scope fields on dedup update when extraction finds nothing", async () => {
    const scope = extractScope("Prefer explicit over implicit wiring");
    expect(Object.keys(scope).length).toBe(0);
    ctx.updatePayload = null;
    await upsertDecisions("repo-1", [
      {
        d: {
          decision: "Prefer explicit over implicit wiring",
          why: "clarity",
          examples: [],
          evidence: ["PR #1"],
        },
        source: "github_pr",
      },
    ]);
    expect(ctx.updatePayload).not.toBeNull();
    const payload = ctx.updatePayload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("domains");
    expect(payload).not.toHaveProperty("services");
    expect(payload).not.toHaveProperty("languages");
    expect(payload).not.toHaveProperty("frameworks");
    const evidence = payload["evidence"] as string[];
    expect(evidence).toContain("old-evidence");
    expect(evidence).toContain("PR #1");
  });
});
