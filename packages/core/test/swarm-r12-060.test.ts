import { describe, it, expect, vi, afterEach } from "vitest";
import { Logger } from "../src/logger";

function capture(fn: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return lines.join("\n");
}

afterEach(() => vi.restoreAllMocks());

describe("logger redact shared references", () => {
  it("does not report shared non-circular object as circular", () => {
    const shared = { id: 42, name: "ada" };
    const out = capture(() => new Logger().info("x", { actor: shared, user: shared }));
    expect(out).not.toContain("[circular]");
    const parsed = JSON.parse(out);
    expect(parsed.actor).toEqual({ id: 42, name: "ada" });
    expect(parsed.user).toEqual({ id: 42, name: "ada" });
  });

  it("does not report shared array as circular and still detects real cycles", () => {
    const shared = [1, 2, 3];
    const out = capture(() => new Logger().info("x", { a: shared, b: shared }));
    const parsed = JSON.parse(out);
    expect(parsed.a).toEqual([1, 2, 3]);
    expect(parsed.b).toEqual([1, 2, 3]);

    const circular: Record<string, unknown> = { name: "c" };
    circular.self = circular;
    const out2 = capture(() => new Logger().info("y", { item: circular }));
    const parsed2 = JSON.parse(out2);
    expect(parsed2.item.self).toBe("[circular]");
    expect(parsed2.item.name).toBe("c");
  });
});
