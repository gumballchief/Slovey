import { describe, expect, it } from "vitest";
import {
  restoreWinnerStatus,
  shouldRestoreWinnerAfterPending,
} from "../src/pipelines/check";

describe("L193 pending overwrite must restore winner", () => {
  it("only restores when this run posted pending and winner is terminal", () => {
    expect(shouldRestoreWinnerAfterPending(true, "conflict")).toBe(true);
    expect(shouldRestoreWinnerAfterPending(true, "clear")).toBe(true);
    expect(shouldRestoreWinnerAfterPending(false, "conflict")).toBe(false);
    expect(shouldRestoreWinnerAfterPending(false, "clear")).toBe(false);
    expect(shouldRestoreWinnerAfterPending(true, "skipped")).toBe(false);
    expect(shouldRestoreWinnerAfterPending(true, null)).toBe(false);
  });

  it("re-applies the winner terminal status over stale pending", async () => {
    const posted: Array<{ state: string; description: string }> = [];
    const ok = await restoreWinnerStatus(
      (s) => {
        posted.push({ state: s.state, description: s.description });
        return Promise.resolve();
      },
      "clear",
      null,
    );
    expect(ok).toBe(true);
    expect(posted.length).toBe(1);
    expect(posted[0]?.state).toBe("success");
  });
});
