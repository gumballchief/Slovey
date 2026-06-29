import { loadEnv } from "@company-brain/config";
import { GeminiEmbeddingProvider } from "./gemini";
import { OpenAIEmbeddingProvider } from "./openai";
import type { EmbeddingProvider } from "./types";
import { VoyageProvider } from "./voyage";

let _provider: EmbeddingProvider | null = null;

export function getEmbeddings(): EmbeddingProvider {
  if (_provider) return _provider;
  const env = loadEnv();
  if (env.EMBEDDING_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required for openai embeddings");
    _provider = new OpenAIEmbeddingProvider(
      env.OPENAI_API_KEY,
      env.OPENAI_EMBEDDING_MODEL,
      env.EMBEDDING_DIMENSIONS,
    );
  } else if (env.EMBEDDING_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY required for gemini embeddings");
    _provider = new GeminiEmbeddingProvider(
      env.GEMINI_API_KEY,
      env.GEMINI_EMBEDDING_MODEL,
      env.EMBEDDING_DIMENSIONS,
    );
  } else {
    if (!env.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY required for voyage embeddings");
    _provider = new VoyageProvider(
      env.VOYAGE_API_KEY,
      env.VOYAGE_MODEL,
      env.EMBEDDING_DIMENSIONS,
    );
  }
  return _provider;
}

export function setEmbeddings(provider: EmbeddingProvider | null) {
  _provider = provider;
}

export type { EmbeddingProvider } from "./types";
export { VoyageProvider } from "./voyage";
export { OpenAIEmbeddingProvider } from "./openai";
export { GeminiEmbeddingProvider } from "./gemini";
