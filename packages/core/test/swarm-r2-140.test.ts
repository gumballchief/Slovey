import { beforeEach, describe, expect, it, vi } from "vitest";
import { setEmbeddings } from "../src/embeddings";
import { createDecision } from "../src/services/dashboard";

const state = vi.hoisted(() => ({ selectCalls: 0, insertCalled: false, embedCalls: 0 }));

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig: any = await importOriginal();
  const fakeDb = {
    select: (_proj: any) => {
      const idx = state.selectCalls++;
      const builder: any = {
        from() { return builder; },
        innerJoin() { return builder; },
        where() { return builder; },
        orderBy() { return builder; },
        limit() { return builder; },
        groupBy() { return builder; },
        then(resolve: any, reject: any) {
          let val: any = [];
          if (idx === 0) val = [{ id: "org-1", name: "Acme", slug: "acme" }];
          else if (idx === 1) val = [{ plan: "free" }];
          else if (idx === 2) val = [{ n: 1 }];
          else if (idx === 3) val = [{ n: 1 }];
          else if (idx === 4) val = [{ n: 200 }];
          else if (idx === 5) val = [{ prs: 0, conflicts: 0 }];
          return Promise.resolve(val).then(resolve, reject);
        },
      };
      return builder;
    },
    insert: () => ({
      values: () => ({
        returning: async () => {
          state.insertCalled = true;
          return [{ id: "d1", decision: "x", why: "", examples: [], evidence: [], source: "github_pr", status: "approved", createdAt: new Date(), repoId: "repo-1" }];
        },
      }),
    }),
  };
  return { ...orig, getDb: () => fakeDb };
});

describe("R2-140 free-plan decision cap", () => {
  beforeEach(() => {
    state.selectCalls = 0;
    state.insertCalled = false;
    state.embedCalls = 0;
    setEmbeddings({ embedOne: async () => { state.embedCalls++; return [0.1, 0.2]; } } as any);
  });
  it("rejects createDecision when free plan is at 200 decisions", async () => {
    await expect(createDecision("repo-1", { decision: "use X", evidence: [] })).rejects.toThrow(/limit/i);
    expect(state.insertCalled).toBe(false);
  });
});
