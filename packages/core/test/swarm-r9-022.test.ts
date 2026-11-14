import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  set: null as Record<string, unknown> | null,
}));

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@company-brain/db")>();
  return {
    ...orig,
    getDb: () =>
      ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "d1",
                  repoId: "repo-a",
                  title: "t",
                  decision: "d",
                  why: "w",
                  examples: [] as string[],
                  version: 1,
                },
              ],
            }),
          }),
        }),
        update: () => ({
          set: (s: Record<string, unknown>) => {
            state.set = s;
            return {
              where: () => ({
                returning: async () => [{ id: "d1", repoId: "repo-a", version: 2 }],
              }),
            };
          },
        }),
        insert: () => ({
          values: async () => [],
        }),
      }) as unknown as ReturnType<typeof orig.getDb>,
  };
});

import { updateDecision } from "../src/graph/service";

describe("R9-022 mass-assignment guard", () => {
  it("does not copy repoId/review/approvedAt/etc into UPDATE SET", async () => {
    const malicious = {
      summary: "legit edit",
      repoId: "victim-repo",
      review: "confirmed",
      approvedAt: new Date(),
      embedding: [1, 2, 3],
      version: 99,
      id: "other-id",
      createdBy: "attacker",
    } as unknown as Parameters<typeof updateDecision>[2];
    await updateDecision("repo-a", "d1", malicious);
    expect(state.set).not.toBeNull();
    expect(state.set).toMatchObject({ summary: "legit edit" });
    expect(state.set).not.toHaveProperty("repoId");
    expect(state.set).not.toHaveProperty("review");
    expect(state.set).not.toHaveProperty("approvedAt");
    expect(state.set).not.toHaveProperty("embedding");
    expect(state.set).not.toHaveProperty("createdBy");
    expect(state.set).not.toHaveProperty("id");
    expect((state.set as Record<string, unknown>)["version"]).not.toBe(99);
  });
});
