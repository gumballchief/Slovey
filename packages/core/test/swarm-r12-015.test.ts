import { describe, it, expect, vi, afterEach } from "vitest";
import { Logger } from "../src/logger";

afterEach(() => { vi.restoreAllMocks(); });

describe("logger with BigInt fields", () => {
  it("does not throw and logs BigInt as string", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(String(a[0])); });
    const logger = new Logger();
    expect(() => logger.info("count", { count: 10n })).not.toThrow();
    expect(() => logger.child({ total: 42n }).info("nested", { items: [1n, { v: 2n }] })).not.toThrow();
    expect(lines).toHaveLength(2);
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(parsed.count).toBe("10");
    const parsed2 = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(parsed2.total).toBe("42");
    expect(parsed2.items).toEqual(["1", { v: "2" }]);
  });
});
