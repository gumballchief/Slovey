import { describe, it, expect, vi, afterEach } from "vitest";
import { AnthropicProvider } from "../src/ai/anthropic";
import type { AICompleteOptions } from "../src/ai/types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completeJSON single budget (R6-002)", () => {
  it("shares one deadline across both attempts with shrinking timeoutMs", async () => {
    const provider = new AnthropicProvider({
      apiKey: "test-key",
      premiumModel: "premium",
      cheapModel: "cheap",
    });
    const seen: Array<number | undefined> = [];
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let calls = 0;
    vi.spyOn(provider, "complete").mockImplementation(
      async (_prompt: string, opts: AICompleteOptions = {}): Promise<string> => {
        seen.push(opts.timeoutMs);
        calls += 1;
        // Simulate time spent generating the first (invalid) response.
        now += 200;
        if (calls === 1) return "not json at all";
        return '{"ok":true}';
      },
    );
    const result = await provider.completeJSON<{ ok: boolean }>("prompt", {
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(1000);
    expect(seen[1]).toBeDefined();
    expect(seen[1] as number).toBeLessThan(seen[0] as number);
  });
});
