import { describe, expect, it, vi } from "vitest";
import { restoreWinnerStatus } from "../src/pipelines/check";

describe("restoreWinnerStatus (L195)", () => {
  it("re-applies winner conflict as failure", async () => {
    const post = vi.fn(async (_s: { state: string; description: string }) => {});
    const restored = await restoreWinnerStatus(post, "conflict", "blocks merge");
    expect(restored).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![0].state).toBe("failure");
  });

  it("re-applies winner clear as success", async () => {
    const post = vi.fn(async (_s: { state: string; description: string }) => {});
    await restoreWinnerStatus(post, "clear", null);
    expect(post.mock.calls[0]![0].state).toBe("success");
  });

  it("does not post for non-terminal winner verdicts", async () => {
    const post = vi.fn(async (_s: { state: string; description: string }) => {});
    expect(await restoreWinnerStatus(post, "skipped", null)).toBe(false);
    expect(await restoreWinnerStatus(post, null, null)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("retries transient failures via runWinnerRestore", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({});
    const restored = await restoreWinnerStatus(post, "conflict", "x");
    expect(restored).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
