import { getAI } from "../ai";
import { extractDocPrompt } from "../ai/prompts";
import type { ExtractedDecision } from "../ai/types";
import { upsertDecisions } from "./upsert-decisions";

export interface ImportDoc {
  /** Cited as the decision's evidence (filename / ADR id / heading). */
  path: string;
  content: string;
}

export interface ImportResult {
  docs: number;
  extracted: number;
  inserted: number;
  updated: number;
}

const MAX_DOCS = 30;
const MAX_CHARS = 16_000; // bound prompt size per doc

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/**
 * Coerce LLM-returned evidence into string[]; fall back to the doc path so a
 * decision is never stored without provenance.
 */
export function normalizeEvidence(ev: unknown, fallback: string): string[] {
  if (Array.isArray(ev)) {
    const x = uniq(ev.map((e) => String(e).trim()));
    return x.length ? x : [fallback];
  }
  if (typeof ev === "string" && ev.trim()) return uniq(ev.split(",").map((s) => s.trim()));
  return [fallback];
}

/**
 * Split a pasted markdown blob into documents on top-level `# ` headings — so a
 * user can paste a whole ADR folder / architecture doc at once and get one
 * document per section. Pure + testable. No heading ⇒ a single doc.
 */
export function splitDocs(raw: string, fallbackPath = "pasted-doc"): ImportDoc[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const hasH1 = lines.some((l) => /^#\s+\S/.test(l));
  if (!hasH1) return [{ path: fallbackPath, content: text }];

  const docs: ImportDoc[] = [];
  let title = "";
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join("\n").trim();
    if (content) docs.push({ path: title ? `${slugify(title)}.md` : fallbackPath, content });
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) {
      flush();
      title = m[1] ?? "";
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();
  return docs;
}

/**
 * Import existing decision docs (ADRs / RFCs / architecture markdown) as
 * **proposed** decisions for human review. The fastest cure for a cold-start:
 * seed the graph from the docs you already wrote. Reuses the same extractor as
 * PR/doc ingestion; everything lands in the review queue (source = "doc").
 */
export async function importDocs(repoId: string, docs: ImportDoc[]): Promise<ImportResult> {
  const ai = getAI();
  const items: { d: ExtractedDecision; source: "doc" }[] = [];
  let extracted = 0;

  for (const doc of docs.slice(0, MAX_DOCS)) {
    const content = (doc.content ?? "").slice(0, MAX_CHARS);
    if (!content.trim()) continue;
    const res = await ai.completeJSON<ExtractedDecision[]>(
      extractDocPrompt(`### ${doc.path}\n${content}`),
      { tier: "cheap", maxTokens: 2000 },
    );
    if (!Array.isArray(res)) continue;
    for (const d of res) {
      if (!d?.decision) continue;
      extracted++;
      items.push({ d: { ...d, evidence: normalizeEvidence(d.evidence, doc.path) }, source: "doc" });
    }
  }

  if (items.length === 0) return { docs: docs.length, extracted: 0, inserted: 0, updated: 0 };
  const { inserted, updated } = await upsertDecisions(repoId, items, "import");
  return { docs: docs.length, extracted, inserted, updated };
}
