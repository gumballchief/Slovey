import { describe, it, expect, vi, afterEach } from "vitest";
import { GeminiEmbeddingProvider } from "../src/embeddings/gemini";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GeminiEmbeddingProvider batch chunking (R6-148)", () => {
  it("splits >100 texts into <=100 per batchEmbedContents call in order", async () => {
    const provider = new GeminiEmbeddingProvider("test-key", "gemini-embedding-001", 3);
    const texts = Array.from({ length: 250 }, (_, i) => `text ${i}`);
    const batchSizes: number[] = [];
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      const bodyText = String(init?.body ?? "{}");
      const body = JSON.parse(bodyText) as {
        requests: Array<{ content: { parts: Array<{ text: string }> } }>;
      };
      batchSizes.push(body.requests.length);
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          embeddings: body.requests.map((r) => {
            const t = r.content.parts[0]?.text ?? "";
            const n = Number(t.split(" ")[1]);
            return { values: [n] };
          }),
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await provider.embed(texts);
    expect(result).toHaveLength(250);
    for (let i = 0; i < 250; i++) {
      expect(result[i]?.[0]).toBe(i);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(batchSizes).toEqual([100, 100, 50]);
    for (const s of batchSizes) {
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
