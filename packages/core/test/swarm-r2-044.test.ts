import { describe, it, expect, vi } from "vitest";
import { Logger } from "../src/logger";

describe("R2-044 nested redaction", () => {
  it("redacts secrets nested in objects/arrays and child context", () => {
    process.env.LOG_LEVEL = "debug";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const log = new Logger().child({ token: "ctx-secret" });
      log.info("request", {
        payload: { apiKey: "sk-secret-value", nested: { password: "pw-secret" } },
        headers: { authorization: "Bearer abc123" },
        list: [{ access_token: "tok-secret" }],
      } as Record<string, unknown>);
      expect(spy).toHaveBeenCalledOnce();
      const raw = String(spy.mock.calls[0][0]);
      const line = JSON.parse(raw) as any;
      expect(line.payload.apiKey).toBe("[redacted]");
      expect(line.payload.nested.password).toBe("[redacted]");
      expect(line.headers.authorization).toBe("[redacted]");
      expect(line.list[0].access_token).toBe("[redacted]");
      expect(line.token).toBe("[redacted]");
      expect(raw).not.toContain("sk-secret-value");
      expect(raw).not.toContain("Bearer abc123");
      expect(raw).not.toContain("ctx-secret");
    } finally {
      spy.mockRestore();
    }
  });

  it("does not crash on circular nested values", () => {
    process.env.LOG_LEVEL = "debug";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const loop: Record<string, unknown> = { apiKey: "outer" };
      (loop as any).self = loop;
      const log = new Logger();
      expect(() => log.info("circular", { payload: loop } as any)).not.toThrow();
      const raw = String(spy.mock.calls[0][0]);
      expect(raw).not.toContain("outer");
    } finally {
      spy.mockRestore();
    }
  });
});
