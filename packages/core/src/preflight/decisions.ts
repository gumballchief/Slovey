import { decisions as decisionsTable, getDb } from "@company-brain/db";
import { and, eq } from "drizzle-orm";
import { getAI } from "../ai";
import { retrieveDecisions } from "../pipelines/retrieve";
import type { DecisionViolation, EvidenceRef } from "./types";

/** Classify a raw evidence string ("PR #296", "docs/adr-17.md", …) into a typed ref. */
export function toEvidenceRefs(raw: string[]): EvidenceRef[] {
  return raw.map((s) => {
    const t = s.trim();
    if (/^(pr\s*#|#)\d+/i.test(t) || /pull request/i.test(t)) return { type: "pr" as const, id: t };
    if (/\badr\b|architecture decision record/i.test(t)) return { type: "adr" as const, id: t };
    if (/^https?:\/\//i.test(t)) return { type: "doc" as const, id: t, url: t };
    if (/[\\/]|\.(md|txt|ts|tsx|js|jsx|json|ya?ml)$/i.test(t)) return { type: "doc" as const, id: t };
    return { type: "decision" as const, id: t };
  });
}

interface CatalogEntry {
  id: string;
  title: string;
  decision: string;
  evidence: string[];
  status: "active" | "rejected";
}
interface RawViolation {
  decisionId: string;
  violation: string;
  confidence: number;
}

/** Rejected decisions for a repo — drives derived architecture rules + the agent gate. */
export async function fetchRejectedDecisions(repoId: string): Promise<{ id: string; decision: string }[]> {
  const db = getDb();
  return db
    .select({ id: decisionsTable.id, decision: decisionsTable.decision })
    .from(decisionsTable)
    .where(and(eq(decisionsTable.repoId, repoId), eq(decisionsTable.status, "rejected")))
    .limit(50)
    .catch(() => [] as { id: string; decision: string }[]);
}

/**
 * Check the working-tree diff against the Engineering Decision Graph: active
 * constraints, rejected approaches, deprecated/removed patterns, architecture
 * rules. Uses the AI judge, with a conservative keyword fallback for rejected
 * decisions when AI is unavailable. Best-effort: never throws.
 */
export async function runDecisionCheck(
  repoId: string,
  diff: string,
  changedFiles: string[],
): Promise<{ violations: DecisionViolation[]; note?: string }> {
  if (!diff.trim() && changedFiles.length === 0) {
    return { violations: [], note: "No changes to check against the decision graph." };
  }
  const db = getDb();
  const [relevant, rejected] = await Promise.all([
    retrieveDecisions(
      repoId,
      { title: "preflight change", body: diff || changedFiles.join("\n"), changedFiles },
      { topK: 10 },
    ).catch(() => []),
    db
      .select({
        id: decisionsTable.id,
        decision: decisionsTable.decision,
        evidence: decisionsTable.evidence,
        title: decisionsTable.title,
      })
      .from(decisionsTable)
      .where(and(eq(decisionsTable.repoId, repoId), eq(decisionsTable.status, "rejected")))
      .limit(50)
      .catch(() => [] as { id: string; decision: string; evidence: string[] | null; title: string | null }[]),
  ]);

  const catalog = new Map<string, CatalogEntry>();
  for (const d of relevant) {
    catalog.set(d.id, { id: d.id, title: d.decision.slice(0, 90), decision: d.decision, evidence: d.evidence ?? [], status: "active" });
  }
  for (const d of rejected) {
    catalog.set(d.id, {
      id: d.id,
      title: (d.title ?? d.decision).slice(0, 90),
      decision: d.decision,
      evidence: d.evidence ?? [],
      status: "rejected",
    });
  }
  if (catalog.size === 0) return { violations: [], note: "No governing decisions found for the changed files." };

  const list = [...catalog.values()];
  let raw: { violations?: RawViolation[] } | null = null;
  try {
    raw = await getAI().completeJSON<{ violations: RawViolation[] }>(buildPrompt(list, diff), { tier: "premium", maxTokens: 900 });
  } catch {
    raw = null;
  }

  if (!raw) return { violations: keywordFallback(list, diff), note: "Decision check ran in keyword-only mode (AI unavailable)." };

  const violations: DecisionViolation[] = [];
  for (const v of raw.violations ?? []) {
    const d = catalog.get(v.decisionId);
    if (!d) continue;
    violations.push(toViolation(d, v.violation, clamp(v.confidence)));
  }
  return { violations };
}

function toViolation(d: CatalogEntry, violation: string, confidence: number): DecisionViolation {
  const isRejected = d.status === "rejected";
  return {
    decisionId: d.id,
    title: d.title,
    decisionStatus: d.status,
    violation,
    confidence,
    evidence: toEvidenceRefs(d.evidence),
    instructionForAgent:
      `Agent, do not commit. ${isRejected ? "This reintroduces a REJECTED approach" : "This violates an active team decision"}: ` +
      `"${d.title}". ${violation} Replace it with the approved pattern, then run Preflight again.`,
  };
}

function buildPrompt(list: CatalogEntry[], diff: string): string {
  const decisionsText = list
    .map((d) => `- id=${d.id} [${d.status}] ${d.decision}`)
    .join("\n");
  return `You are a strict code reviewer enforcing a team's engineering decisions against a diff.

DECISIONS (active = must follow; rejected = must NOT reintroduce):
${decisionsText}

DIFF:
${diff || "(no textual diff available)"}

Return ONLY JSON: {"violations":[{"decisionId":"<id>","violation":"<one sentence on exactly what the diff does that breaks this decision>","confidence":<0..1>}]}. If nothing violates, return {"violations":[]}. Only flag clear violations.`;
}

const STOP = new Set(["with", "that", "this", "from", "code", "should", "must", "using", "used", "into", "than", "when", "team", "approach", "instead", "because", "rejected", "decision", "there", "their", "which", "where", "value", "values", "never", "always", "does", "will", "have", "been", "were", "more", "less", "only", "avoid", "cause", "causes"]);

/** Words that are everywhere in ordinary code — a derived rule on any of these
 *  interrupts constantly with false positives (found live: "route" matched every
 *  Next.js route file; "placeholder" matched every <input placeholder=…>).
 *  A term this generic can never carry a rejected decision on its own — the AI
 *  judge handles those semantically. */
const GENERIC_CODE_TERMS = new Set([
  "route", "routes", "router", "placeholder", "placeholders", "component", "components",
  "endpoint", "endpoints", "page", "pages", "button", "input", "search", "handler",
  "handlers", "request", "response", "service", "services", "server", "client",
  "config", "import", "export", "index", "data", "user", "users", "market", "markets",
  "function", "functions", "module", "modules", "helper", "helpers", "type", "types",
  "test", "tests", "file", "files", "update", "updates", "create", "delete", "display",
  "displayed", "logic", "state", "props", "auto", "sync", "async", "demo", "balance",
  "balances", "product", "removed", "welcome", "modal", "presents", "currently",
]);

/** Distinctive terms of a decision's text — the words a violation would reuse
 *  (tech/package names survive; connective English + generic code words are
 *  stopped out). */
export function distinctiveTerms(decisionText: string, max = 4): string[] {
  return [...new Set(decisionText.toLowerCase().match(/[a-z][a-z0-9.+@/-]{3,}/g) ?? [])]
    .filter((t) => !STOP.has(t) && !GENERIC_CODE_TERMS.has(t))
    .slice(0, max);
}

/** A distinctive term from a rejected decision that reappears in the diff, or null.
 *  E.g. rejectedKeywordHit("Redis was rejected…", "import Redis") → "redis". */
export function rejectedKeywordHit(decisionText: string, diff: string): string | null {
  const hay = diff.toLowerCase();
  return distinctiveTerms(decisionText, 40).find((t) => new RegExp(`\\b${t.replace(/[.+@/-]/g, "\\$&")}\\b`).test(hay)) ?? null;
}

/**
 * Vet derived-keyword hits with the judge before they block: keyword matching
 * can't tell `requestAirdrop()` from a comment containing the word. Returns the
 * indexes of GENUINE reintroductions, or null when AI is unavailable (caller
 * keeps all hits — the deterministic guard must not weaken when AI is down).
 */
export async function confirmDerivedHits(
  hits: { file: string; line?: number; raw?: string; message: string }[],
): Promise<Set<number> | null> {
  if (hits.length === 0) return new Set();
  const list = hits
    .map((h, i) => `${i}. ${h.file}${h.line ? `:${h.line}` : ""}\n   flagged line: ${(h.raw ?? "").slice(0, 160)}\n   rule: ${h.message.slice(0, 160)}`)
    .join("\n");
  try {
    const r = await getAI().completeJSON<{ genuine: number[] }>(
      `Keyword rules derived from REJECTED team decisions flagged these lines. Keyword matching is crude:
a comment, an import path, a UI attribute (like <input placeholder=…>), or an unrelated identifier that
merely CONTAINS the word is NOT a violation. A line only violates if it genuinely REINTRODUCES the
rejected approach described in the rule.

${list}

Return ONLY JSON: {"genuine":[indexes of real violations]}. No real violations → {"genuine":[]}.`,
      { tier: "cheap", maxTokens: 300 },
    );
    if (!r || !Array.isArray(r.genuine)) return null;
    return new Set(r.genuine.filter((n) => Number.isInteger(n) && n >= 0 && n < hits.length));
  } catch {
    return null;
  }
}

/** When AI is unavailable: flag rejected decisions whose term reappears in the diff.
 *  A whole-word match on a rejected decision's distinctive term is a strong signal,
 *  so it carries blocking confidence (0.9) — the gate should not weaken when the
 *  AI judge is down. */
function keywordFallback(list: CatalogEntry[], diff: string): DecisionViolation[] {
  const out: DecisionViolation[] = [];
  for (const d of list) {
    if (d.status !== "rejected") continue;
    const hit = rejectedKeywordHit(d.decision, diff);
    if (hit) out.push(toViolation(d, `The diff reintroduces "${hit}", which this rejected decision forbids.`, 0.9));
  }
  return out;
}

function clamp(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}
