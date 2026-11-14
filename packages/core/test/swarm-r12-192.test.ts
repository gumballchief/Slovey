import { describe, expect, it } from "vitest";
import { runCheckForPr } from "../src/pipelines/check";

describe("runCheckForPr (L192 concurrent comment creation)", () => {
  it("serializes concurrent runs for the same PR so the second cannot race the first", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = runCheckForPr("repo:1:42", async () => {
      events.push("first-start");
      await gate;
      events.push("first-end");
      return "first";
    });
    const second = runCheckForPr("repo:1:42", async () => {
      events.push("second-start");
      events.push("second-end");
      return "second";
    });
    // Let the first run start; the second must still be waiting on the lock.
    await new Promise((r) => setTimeout(r, 10));
    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(events).toEqual(["first-start", "first-end", "second-start", "second-end"]);
  });

  it("releases the lock when a run throws", async () => {
    await expect(
      runCheckForPr("repo:1:7", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(runCheckForPr("repo:1:7", async () => "ok")).resolves.toBe("ok");
  });
});
