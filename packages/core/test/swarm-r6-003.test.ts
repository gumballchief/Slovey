import { describe, it, expect, afterEach } from "vitest";
import { GeminiProvider } from "../src/ai/gemini";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe("gemini completeStream truncation (R6-003)", () => {
  it("re-throws mid-stream failure after partial output instead of returning a truncated prefix", async () => {
    let fallbackCalls = 0;
    globalThis.fetch = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("streamGenerateContent")) {
        let sent = false;
        const stream = new ReadableStream<Uint8Array>({
          pull(controller) {
            if (!sent) {
              sent = true;
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"candidates":[{"content":{"parts":[{"text":"partial-"}]}}]}\n\n',
                ),
              );
            } else {
              controller.error(new Error("socket abort"));
            }
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      fallbackCalls++;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "fallback" }] } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const provider = new GeminiProvider({ apiKey: "k", premiumModel: "m", cheapModel: "c" });
    const chunks: string[] = [];
    let threw = false;
    try {
      for await (const c of provider.completeStream("hello", { timeoutMs: 5000 })) chunks.push(c);
    } catch {
      threw = true;
    }
    expect(chunks.join("")).toContain("partial-");
    // Must surface the truncation so callers retry/fallback instead of trusting partial output.
    expect(threw).toBe(true);
    expect(fallbackCalls).toBe(0);
  });

  it("still falls back when the stream fails before any output", async () => {
    globalThis.fetch = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("streamGenerateContent")) {
        const stream = new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.error(new Error("socket abort"));
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "fallback-full" }] } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const provider = new GeminiProvider({ apiKey: "k", premiumModel: "m", cheapModel: "c" });
    const chunks: string[] = [];
    for await (const c of provider.completeStream("hello", { timeoutMs: 5000 })) chunks.push(c);
    expect(chunks.join("")).toBe("fallback-full");
  });
});
