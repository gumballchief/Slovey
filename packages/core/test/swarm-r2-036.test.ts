import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const state = { inserted: 0 };
  function selectChain(): any {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve([]),
      then: (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject),
    };
    return chain;
  }
  function insertChain(): any {
    const chain: any = {
      values: () => {
        state.inserted++;
        return chain;
      },
      returning: () => Promise.resolve([{ id: "edge-1" }]),
    };
    return chain;
  }
  return { state, db: { select: () => selectChain(), insert: () => insertChain() } };
});

vi.mock("@company-brain/db", async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, getDb: () => fake.db };
});

import { addEdge } from "../src/graph/service";

describe("swarm-r2-036 cross-repo edge grafting", () => {
  beforeEach(() => {
    fake.state.inserted = 0;
  });

  it("rejects an edge whose decisions are not in the caller's repo", async () => {
    await expect(
      addEdge("attacker-repo", "victim-decision", "contradicts", { decisionId: "victim-other" }),
    ).rejects.toThrow();
    expect(fake.state.inserted).toBe(0);
  });
});
