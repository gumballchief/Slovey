import { describe, expect, it, vi } from "vitest";

vi.mock("../src/pipelines/retrieve", () => ({
  retrieveDecisions: vi.fn(() => Promise.reject(new Error("embedding down"))),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
}));

vi.mock("@company-brain/db", () => ({
  decisions: { id: "id", repoId: "repoId", status: "status", decision: "decision", evidence: "evidence", title: "title" },
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.reject(new Error("db down")),
        }),
      }),
    }),
  })),
}));

import { runDecisionCheck } from "../src/preflight/decisions";

describe("R10-057 decision store failure is not reported as clean", () => {
  it("reports unavailable/unverified instead of 'No governing decisions found'", async () => {
    const result = await runDecisionCheck("repo-1", "const x = 1;", ["src/a.ts"]);
    expect(result.violations).toEqual([]);
    expect(result.note).toBeDefined();
    expect(result.note ?? "").not.toMatch(/No governing decisions found/);
    expect((result.note ?? "").toLowerCase()).toMatch(/unavailable|unverified|error/);
    expect(result.unverified).toBe(true);
  });
});
