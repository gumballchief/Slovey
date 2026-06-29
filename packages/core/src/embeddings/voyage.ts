import type { EmbeddingProvider } from "./types";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export class VoyageProvider implements EmbeddingProvider {
  readonly name = "voyage";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    if (!v) throw new Error("Voyage returned no embedding");
    return v;
  }
}
