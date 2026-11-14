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
const MAX_RAW_CHARS = 200_000; // bound splitDocs work for pasted blobs

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
  if (typeof ev === "string" && ev.trim()) {
    const x = uniq(ev.split(",").map((s) => s.trim()));
    return x.length ? x : [fallback];
  }
  return [fallback];
}

/**
 * Split a pasted markdown blob into documents on top-level `# ` headings — so a
 * user can paste a whole ADR folder / architecture doc at once and get one
 * document per section. Pure + testable. No heading ⇒ a single doc.
 */
export function splitDocs(raw: string, fallbackPath = "pasted-doc"): ImportDoc[] {
  const capped = (raw ?? "").slice(0, MAX_RAW_CHARS);
  const text = capped.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const hasH1 = lines.some((l) => /^#\s+\S/.test(l));
  if (!hasH1) return [{ path: fallbackPath, content: text }];

  const docs: ImportDoc[] = [];
  let title = "";
  let buf: string[] = [];
  const used = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const uniquePath = (base: string): string => {
    if (!used.has(base)) {
      used.add(base);
      nextSuffix.set(base, 2);
      return base;
    }
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    let n = nextSuffix.get(base) ?? 2;
    let dup = `${stem}-${n}${ext}`;
    while (used.has(dup)) {
      n++;
      dup = `${stem}-${n}${ext}`;
    }
    used.add(dup);
    nextSuffix.set(base, n + 1);
    return dup;
  };
  const flush = () => {
    const content = buf.join("\n").trim();
    if (!content) {
      buf = [];
      return;
    }
    if (docs.length >= MAX_DOCS) {
      buf = [];
      return;
    }
    if (!title) {
      docs.push({ path: uniquePath(fallbackPath), content });
    } else {
      const slug = slugify(title);
      const base = slug ? `${slug}.md` : fallbackPath;
      docs.push({ path: uniquePath(base), content });
    }
    buf = [];
  };
  let inFence = false;
  for (const line of lines) {
    if (docs.length >= MAX_DOCS) break;
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence ? line.match(/^#\s+(.+?)\s*$/) : null;
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
const reservedByRepo = new Map<string, number>();

export async function importDocs(
  repoId: string,
  docs: ImportDoc[],
  /** Plan headroom: never upsert more than this many decisions (undefined = unlimited). */
  maxNew?: number,
  /** Org scope for plan headroom: reservations are keyed here so concurrent imports across repos share the org cap. */
  orgId?: string,
): Promise<ImportResult> {
  const ai = getAI();
  // Reserve headroom synchronously (before any await) so concurrent imports
  // for the same org cannot all slice against the same stale maxNew.
  const reservationKey = orgId ?? repoId;
  const alreadyReserved = maxNew !== undefined ? reservedByRepo.get(reservationKey) ?? 0 : 0;
  const effectiveMaxNew = maxNew !== undefined ? Math.max(0, maxNew - alreadyReserved) : undefined;
  if (effectiveMaxNew) reservedByRepo.set(reservationKey, alreadyReserved + effectiveMaxNew);
  const releaseReservation = () => {
    if (!effectiveMaxNew) return;
    const remaining = (reservedByRepo.get(reservationKey) ?? 0) - effectiveMaxNew;
    if (remaining > 0) reservedByRepo.set(reservationKey, remaining);
    else reservedByRepo.delete(reservationKey);
  };
  try {
  if (effectiveMaxNew === 0) return { docs: docs.length, extracted: 0, inserted: 0, updated: 0 };
  const items: { d: ExtractedDecision; source: "doc" }[] = [];
  let extracted = 0;

  for (const doc of docs.slice(0, MAX_DOCS)) {
    const content = (doc.content ?? "").slice(0, MAX_CHARS);
    if (!content.trim()) continue;
    let res: ExtractedDecision[] | null;
    try {
      res = await ai.completeJSON<ExtractedDecision[]>(
        extractDocPrompt(`### ${doc.path}\n${content}`),
        { tier: "cheap", maxTokens: 2000 },
      );
    } catch {
      continue;
    }
    if (!Array.isArray(res)) continue;
    for (const d of res) {
      if (!d?.decision) continue;
      extracted++;
      items.push({ d: { ...d, evidence: normalizeEvidence(d.evidence, doc.path) }, source: "doc" });
    }
  }

  // Enforce the org's remaining plan headroom so one import can't exceed the cap
  // (conservative: counts every item as new, so we never overshoot the limit).
  const toUpsert = effectiveMaxNew !== undefined ? items.slice(0, effectiveMaxNew) : items;
  if (toUpsert.length === 0) return { docs: docs.length, extracted, inserted: 0, updated: 0 };
  const { inserted, updated } = await upsertDecisions(repoId, toUpsert, "import");
  return { docs: docs.length, extracted, inserted, updated };
  } finally {
    releaseReservation();
  }
}
