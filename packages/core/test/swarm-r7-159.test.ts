import { describe, expect, it } from "vitest";
import {
  AGENT_RUN_HEARTBEAT_MS,
  AGENT_RUN_STALE_MS,
  isAgentRunStillOwned,
  isStaleAgentRunForRetry,
} from "../src/services/agent-runs";

describe("R7-159 agent run heartbeat / ownership guard", () => {
  it("heartbeats well before the stale timeout so slow runs are not reclaimed", () => {
    expect(AGENT_RUN_HEARTBEAT_MS).toBeGreaterThan(0);
    expect(AGENT_RUN_HEARTBEAT_MS).toBeLessThan(AGENT_RUN_STALE_MS);
  });

  it("a heartbeat-refreshed row is not stale while the original claim is", () => {
    const claimed = new Date("2026-01-01T00:00:00.000Z");
    const heartbeat = new Date(claimed.getTime() + 5 * 60 * 1000);
    const now = new Date(claimed.getTime() + 11 * 60 * 1000);
    expect(isStaleAgentRunForRetry("running", claimed, now)).toBe(true);
    expect(isStaleAgentRunForRetry("running", heartbeat, now)).toBe(false);
  });

  it("completion guard only overwrites when still owned", () => {
    const owned = new Date("2026-01-01T00:00:00.000Z");
    const reclaimed = new Date(owned.getTime() + 1000);
    expect(isAgentRunStillOwned(owned, owned)).toBe(true);
    expect(isAgentRunStillOwned(reclaimed, owned)).toBe(false);
  });
});
