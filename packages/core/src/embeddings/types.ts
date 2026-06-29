/** Swappable embedding provider. Powers pgvector retrieval. */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  /** Embed a batch. Order of results matches input order. */
  embed(texts: string[]): Promise<number[][]>;
  embedOne(text: string): Promise<number[]>;
}
