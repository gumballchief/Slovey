import { describe, expect, it } from "vitest";
import { shouldSkipStaleSyncError } from "../src/pipelines/ingest-connector";

describe("shouldSkipStaleSyncError", () => {
  it("skips when a later sync advanced lastSyncedAt", () => {
    expect(shouldSkipStaleSyncError(null, new Date("2024-01-02T00:00:00Z"))).toBe(true);
    expect(
      shouldSkipStaleSyncError(
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-02T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("applies when no later sync superseded this run", () => {
    expect(shouldSkipStaleSyncError(null, null)).toBe(false);
    expect(
      shouldSkipStaleSyncError(
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});
