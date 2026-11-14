import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiEmbeddingProvider } from "../src/embeddings/gemini";

function mockFetch(embeddings: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ embeddings }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiEmbeddingProvider partial responses (R10-129)", () => {
  it("throws when Gemini returns fewer embeddings than texts", async () => {
    mockFetch([{ values: [0.1, 0.2] }]);
    const provider = new GeminiEmbeddingProvider("key", "model", 2);
    await expect(provider.embed(["a", "b"])).rejects.toThrow();
  });

  it("throws when an embedding entry has no values", async () => {
    mockFetch([{ values: [0.1, 0.2] }, {}]);
    const provider = new GeminiEmbeddingProvider("key", "model", 2);
    await expect(provider.embed(["a", "b"])).rejects.toThrow();
  });

  it("returns aligned embeddings for a complete response", async () => {
    mockFetch([
      { values: [0.1, 0.2] },
      { values: [0.3, 0.4] },
    ]);
    const provider = new GeminiEmbeddingProvider("key", "model", 2);
    await expect(provider.embed(["a", "b"])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
});
