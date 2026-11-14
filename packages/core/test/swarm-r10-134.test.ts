import { describe, it, expect } from "vitest";
import { OpenAIEmbeddingProvider } from "../src/embeddings/openai";

describe("R10-134 empty string in embedding batch", () => {
  it("does not send empty strings to OpenAI and preserves order", async () => {
    const provider = new OpenAIEmbeddingProvider("test-key", "text-embedding-3-large", 1024);
    const originalFetch = globalThis.fetch;
    let seenInput: string[] | null = null;
    const fakeFetch = (async (_url: unknown, init: unknown) => {
      const bodyText = (init as { body: string }).body;
      const parsed = JSON.parse(bodyText) as { input: string[] };
      seenInput = parsed.input;
      if (parsed.input.some((t) => t.length === 0)) {
        return {
          ok: false,
          status: 400,
          text: async () => "empty string in input",
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: parsed.input.map((_, i) => ({ embedding: [i], index: i })),
        }),
      } as unknown as Response;
    }) as typeof fetch;
    globalThis.fetch = fakeFetch;
    try {
      const out = await provider.embed(["hello", "", "   "]);
      expect(out.length).toBe(3);
      expect(seenInput).not.toBeNull();
      expect(seenInput?.length).toBe(3);
      expect(seenInput?.some((t) => t.length === 0)).toBe(false);
      expect(seenInput?.[0]).toBe("hello");
      expect(out).toEqual([[0], [1], [2]]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
