import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../src/ai/gemini";

describe("Gemini streaming cancellation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cancels the underlying stream when the consumer breaks early", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\n',
          ),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200 })),
    );
    const provider = new GeminiProvider({
      apiKey: "test-key",
      premiumModel: "premium",
      cheapModel: "cheap",
    });
    const seen: string[] = [];
    for await (const chunk of provider.completeStream("prompt")) {
      seen.push(chunk);
      break;
    }
    expect(seen).toEqual(["hello"]);
    expect(cancelled).toBe(true);
  });
});
