import { describe, it, expect } from "vitest";
import { withExtractLock } from "../src/pipelines/extract";

describe("withExtractLock", () => {
  it("serializes concurrent critical sections", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      releaseFirst = r;
    });
    const first = withExtractLock(async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
    });
    const second = withExtractLock(async () => {
      order.push("second-start");
    });
    // Let both calls reach the lock; second must not start before first ends.
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("releases the lock when the critical section throws", async () => {
    await expect(
      withExtractLock(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    let ran = false;
    await withExtractLock(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
