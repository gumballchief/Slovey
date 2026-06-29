import type { EmbeddingProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini embeddings (gemini-embedding-001 supports outputDimensionality, so it
 * can match the 1024-dim column). Uses batchEmbedContents for batches.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const url = `${BASE}/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const requests = texts.map((t) => ({
      model: `models/${this.model}`,
      content: { parts: [{ text: t }] },
      outputDimensionality: this.dimensions,
    }));
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) {
      throw new Error(`Gemini embeddings ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
    return data.embeddings.map((e) => e.values);
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    if (!v) throw new Error("Gemini returned no embedding");
    return v;
  }
}
