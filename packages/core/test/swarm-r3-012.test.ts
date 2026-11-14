import { describe, it, expect, vi, afterEach } from "vitest";
import { AnthropicProvider } from "../src/ai/anthropic";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R3-012 stalled body timeout", () => {
  it("does not hang forever when body stalls", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          status: 200,
          json: () => new Promise(() => {}),
          text: () => new Promise(() => {}),
        }) as unknown as Response,
    );
    const provider = new AnthropicProvider({ apiKey: "k", premiumModel: "m", cheapModel: "m" });
    const outcome = await Promise.race([
      provider.complete("hi", { timeoutMs: 300 }).then(
        () => "settled",
        () => "settled",
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("hung"), 1200)),
    ]);
    expect(outcome).toBe("settled");
  });
});
