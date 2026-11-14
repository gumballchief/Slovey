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
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const chunk = texts.slice(i, i + 100);
      const requests = chunk.map((t) => ({
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
      for (const e of data.embeddings) out.push(e.values);
    }
    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    if (!v) throw new Error("Gemini returned no embedding");
    return v;
  }
}
