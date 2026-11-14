import { describe, it, expect, vi, afterEach } from "vitest";
import * as dbMod from "@company-brain/db";
import { decisions } from "@company-brain/db";
import { listDecisions } from "../src/services/dashboard";

describe("listDecisions bounds data transfer (R6-096)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects explicit columns without embedding and applies a limit", async () => {
    let selectArgs: unknown[][] = [];
    let limitCalled = false;
    let limitValue: unknown;
    const makeChain = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.limit = (n: number) => {
        limitCalled = true;
        limitValue = n;
        return chain;
      };
      chain.then = (resolve: (v: never[]) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve([]).then(resolve, reject);
      return chain;
    };
    const fakeDb = {
      select: (...args: unknown[]) => {
        selectArgs.push(args);
        return makeChain();
      },
    };
    vi.spyOn(dbMod, "getDb").mockReturnValue(
      fakeDb as unknown as ReturnType<typeof dbMod.getDb>,
    );

    await listDecisions("repo-1", {}, undefined);

    // Must project explicit columns (single object arg), not select-all.
    expect(selectArgs.length).toBe(1);
    expect(selectArgs[0].length).toBe(1);
    const cols = selectArgs[0][0] as Record<string, unknown>;
    expect(typeof cols).toBe("object");
    expect(Object.values(cols)).not.toContain(decisions.embedding);
    expect(Object.values(cols)).toContain(decisions.id);
    expect(Object.values(cols)).toContain(decisions.decision);
    // Must bound the result set so a 5000-decision repo cannot OOM the page.
    expect(limitCalled).toBe(true);
    expect(typeof limitValue).toBe("number");
    expect(limitValue as number).toBeGreaterThan(0);
    expect(limitValue as number).toBeLessThanOrEqual(5000);
  });
});
