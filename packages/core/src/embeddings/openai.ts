import type { EmbeddingProvider } from "./types";

const ENDPOINT = "https://api.openai.com/v1/embeddings";

/** Alt provider. text-embedding-3-large supports a `dimensions` param so it can
 *  match the 1024-dim column used by the default Voyage provider. */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
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
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    if (!v) throw new Error("OpenAI returned no embedding");
    return v;
  }
}
