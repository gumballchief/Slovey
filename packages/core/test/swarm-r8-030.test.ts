import { describe, expect, it } from "vitest";
import { runWinnerRestore } from "../src/pipelines/check";

describe("R8-030 loser restore must not be swallowed", () => {
  it("retries a transient failure and restores the winner", async () => {
    let calls = 0;
    const out = await runWinnerRestore(async () => {
      calls += 1;
      if (calls < 2) throw new Error("transient GitHub error");
      return "restored";
    });
    expect(out).toBe("restored");
    expect(calls).toBe(2);
  });

  it("propagates instead of swallowing persistent restore failures", async () => {
    let calls = 0;
    await expect(
      runWinnerRestore(async () => {
        calls += 1;
        throw new Error("github down");
      }),
    ).rejects.toThrow("github down");
    expect(calls).toBeGreaterThan(1);
  });
});
