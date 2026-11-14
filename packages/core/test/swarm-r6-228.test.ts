import { describe, expect, it } from "vitest";
import { rejectedKeywordHit } from "../src/preflight/decisions";

describe("R6-228 binary/renamed diffs", () => {
  it("flags a rejected term appearing only in a changed file path", () => {
    expect(rejectedKeywordHit("Redis cache was rejected for this service", "", ["src/redis-cache.bin"])).toBe("redis");
    expect(rejectedKeywordHit("Redis cache was rejected for this service", "Binary files differ", ["src/redis-cache.bin"])).toBe("redis");
  });

  it("returns null when neither the diff nor the changed files contain a rejected term", () => {
    expect(rejectedKeywordHit("Redis cache was rejected for this service", "", ["src/postgres-store.ts"])).toBeNull();
  });
});
