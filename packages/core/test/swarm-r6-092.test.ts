import { describe, expect, it } from "vitest";
import { AGENT_RUN_STALE_MS, isStaleAgentRunForRetry } from "../src/services/agent-runs";

describe("R6-092 crashed agent run reclaim", () => {
  it("treats stale running as reclaimable so retry re-executes", () => {
    const stale = new Date(Date.now() - AGENT_RUN_STALE_MS - 1000);
    expect(isStaleAgentRunForRetry("running", stale)).toBe(true);
  });

  it("does not reclaim fresh running so retries cannot open a duplicate PR", () => {
    expect(isStaleAgentRunForRetry("running", new Date())).toBe(false);
  });

  it("never reclaims terminal states", () => {
    const stale = new Date(Date.now() - AGENT_RUN_STALE_MS - 60_000);
    expect(isStaleAgentRunForRetry("ready", stale)).toBe(false);
    expect(isStaleAgentRunForRetry("failed", stale)).toBe(false);
    expect(isStaleAgentRunForRetry("queued", stale)).toBe(false);
  });
});
