import { describe, expect, it } from "vitest";
import { resolveHeartbeatAfterError } from "../src/services/agent-runs";

describe("R8-064 heartbeat resync", () => {
  it("adopts the committed beat when the response was lost after commit", () => {
    const expected = new Date("2026-01-01T00:00:00.000Z");
    const beat = new Date("2026-01-01T00:01:00.000Z");
    const resynced = resolveHeartbeatAfterError(expected, beat, new Date("2026-01-01T00:01:00.000Z"));
    expect(resynced.getTime()).toBe(beat.getTime());
  });
  it("keeps the prior heartbeat when the beat never committed", () => {
    const expected = new Date("2026-01-01T00:00:00.000Z");
    const beat = new Date("2026-01-01T00:01:00.000Z");
    const resynced = resolveHeartbeatAfterError(expected, beat, new Date("2026-01-01T00:00:00.000Z"));
    expect(resynced.getTime()).toBe(expected.getTime());
  });
});

describe("R8-064 heartbeat resync never adopts another worker's claim", () => {
  it("keeps the old token when the row was reclaimed by someone else", () => {
    const expected = new Date("2026-01-01T00:00:00.000Z");
    const beat = new Date("2026-01-01T00:01:00.000Z");
    const reclaimedAt = new Date("2026-01-01T00:11:00.000Z");
    const resynced = resolveHeartbeatAfterError(expected, beat, reclaimedAt);
    expect(resynced.getTime()).toBe(expected.getTime());
  });
});
