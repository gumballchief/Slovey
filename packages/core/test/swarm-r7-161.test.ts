import { describe, expect, it } from "vitest";
import {
  AGENT_RUN_HEARTBEAT_MS,
  AGENT_RUN_STALE_MS,
  isAgentRunStillOwned,
  isStaleAgentRunForRetry,
  settleAgentRunHeartbeat,
} from "../src/services/agent-runs";

describe("agent run heartbeat / stale reclaim", () => {
  it("heartbeats well inside the stale window and only stale running runs are reclaimable", () => {
    expect(AGENT_RUN_HEARTBEAT_MS).toBeLessThan(AGENT_RUN_STALE_MS);
    const now = new Date("2024-01-01T00:20:00.000Z");
    const fresh = new Date(now.getTime() - AGENT_RUN_HEARTBEAT_MS);
    const stale = new Date(now.getTime() - AGENT_RUN_STALE_MS - 1);
    expect(isStaleAgentRunForRetry("running", fresh, now)).toBe(false);
    expect(isStaleAgentRunForRetry("running", stale, now)).toBe(true);
    expect(isStaleAgentRunForRetry("ready", stale, now)).toBe(false);
    expect(isStaleAgentRunForRetry("failed", stale, now)).toBe(false);
  });

  it("ownership requires the exact last heartbeat timestamp", () => {
    const beat = new Date("2024-01-01T00:10:00.000Z");
    expect(isAgentRunStillOwned(new Date(beat.getTime()), beat)).toBe(true);
    expect(isAgentRunStillOwned(new Date(beat.getTime() + 1), beat)).toBe(false);
  });

  it("settling clears the timer but waits for an in-flight beat before final updates", async () => {
    let cleared = false;
    let releaseBeat!: () => void;
    const beatInFlight = new Promise<void>((resolve) => {
      releaseBeat = resolve;
    });
    let settled = false;
    const settling = settleAgentRunHeartbeat(() => {
      cleared = true;
    }, beatInFlight).then(() => {
      settled = true;
    });
    expect(cleared).toBe(true);
    await Promise.resolve();
    // The final ready/failed update must not read its ownership token yet:
    // the in-flight beat is about to move updatedAt in the database.
    expect(settled).toBe(false);
    releaseBeat();
    await settling;
    expect(settled).toBe(true);
    await settleAgentRunHeartbeat(() => {}, null);
  });
});
