import { getEmbeddings } from "./index";

let _lastWarn = 0;

/**
 * Embed, or return null when the embedding provider is unavailable (out of
 * credit, outage, bad key). Callers fall back to keyword search for reads and
 * store rows without a vector for writes; `backfillMissingEmbeddings` fills
 * the vectors in once the provider is back.
 */
export async function tryEmbed(text: string): Promise<number[] | null> {
  try {
    return await getEmbeddings().embedOne(text);
  } catch (err) {
    if (Date.now() - _lastWarn > 60_000) {
      _lastWarn = Date.now();
      console.warn(
        "[embeddings] unavailable, using keyword search:",
        err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      );
    }
    return null;
  }
}
