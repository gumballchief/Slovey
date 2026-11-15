/**
 * Keyword scoring used when the embedding provider is unavailable. It stands in
 * for pgvector cosine distance so every search path keeps working (and the AI
 * judge still decides relevance) instead of failing outright.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "will", "your", "about",
  "into", "what", "which", "when", "where", "should", "would", "could", "does", "were",
  "there", "their", "them", "then", "than", "these", "those", "only", "also", "just",
  "can", "use", "using", "used", "our", "are", "not", "but", "any", "all", "how", "why",
  "who", "its", "was", "has", "had", "you", "we", "they", "it", "is", "be", "to", "of",
  "in", "on", "or", "a", "an", "do", "i", "my", "me", "so", "if", "as", "at", "by",
]);

/** Crude stem so "tests"/"testing"/"tested" all match "test". */
function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("es") && !t.endsWith("ses")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** Distinctive lowercase terms in `text` (capped so huge diffs stay cheap). */
export function lexicalTerms(text: string, maxChars = 20_000): Set<string> {
  const out = new Set<string>();
  for (const raw of text.slice(0, maxChars).toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

/**
 * Similarity in [0, 1]: the larger of "how much of the query the decision
 * covers" (short questions) and "how much of the decision the query covers"
 * (long diffs mentioning a decision's key terms).
 */
export function lexicalSimilarity(query: Set<string>, doc: Set<string>): number {
  if (query.size === 0 || doc.size === 0) return 0;
  let hits = 0;
  for (const t of doc) if (query.has(t)) hits++;
  return Math.max(hits / query.size, hits / doc.size);
}

/** Pseudo cosine distance (0 = closest) so callers can keep their thresholds. */
export function lexicalDistance(query: Set<string>, doc: Set<string>): number {
  return 1 - lexicalSimilarity(query, doc);
}
