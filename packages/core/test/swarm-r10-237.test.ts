import { describe, expect, it, vi } from "vitest";
import { scheduleForcedSettlement } from "../src/preflight/runner";

describe("scheduleForcedSettlement", () => {
  it("destroys stdio and forces settlement when close never arrives", async () => {
    const destroyStdout = vi.fn();
    const destroyStderr = vi.fn();
    const onForce = vi.fn();
    scheduleForcedSettlement(
      { stdout: { destroy: destroyStdout }, stderr: { destroy: destroyStderr } },
      5,
      onForce,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    expect(destroyStdout).toHaveBeenCalledOnce();
    expect(destroyStderr).toHaveBeenCalledOnce();
    expect(onForce).toHaveBeenCalledOnce();
  });

  it("does not force settlement when cancelled by a timely close", async () => {
    const destroyStdout = vi.fn();
    const onForce = vi.fn();
    const cancel = scheduleForcedSettlement(
      { stdout: { destroy: destroyStdout }, stderr: null },
      5,
      onForce,
    );
    cancel();
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    expect(destroyStdout).not.toHaveBeenCalled();
    expect(onForce).not.toHaveBeenCalled();
  });
});
