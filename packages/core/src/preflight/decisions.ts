import { decisions as decisionsTable, getDb } from "@company-brain/db";
import { and, eq } from "drizzle-orm";
import { getAI } from "../ai";
import { retrieveDecisions } from "../pipelines/retrieve";
import type { DecisionViolation } from "./types";

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
    violation,
    confidence,
    evidence: d.evidence,
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

const STOP = new Set(["with", "that", "this", "from", "code", "should", "must", "using", "used", "into", "than", "when", "team", "approach", "instead", "because", "rejected", "decision", "there", "their", "which", "where", "value", "values"]);

/** A distinctive term from a rejected decision that reappears in the diff, or null.
 *  E.g. rejectedKeywordHit("Redis was rejected…", "import Redis") → "redis". */
export function rejectedKeywordHit(decisionText: string, diff: string): string | null {
  const hay = diff.toLowerCase();
  const terms = [...new Set(decisionText.toLowerCase().match(/[a-z][a-z0-9.+-]{3,}/g) ?? [])].filter((t) => !STOP.has(t));
  return terms.find((t) => new RegExp(`\\b${t.replace(/[.+-]/g, "\\$&")}\\b`).test(hay)) ?? null;
}

/** When AI is unavailable: flag rejected decisions whose term reappears in the diff. */
function keywordFallback(list: CatalogEntry[], diff: string): DecisionViolation[] {
  const out: DecisionViolation[] = [];
  for (const d of list) {
    if (d.status !== "rejected") continue;
    const hit = rejectedKeywordHit(d.decision, diff);
    if (hit) out.push(toViolation(d, `The diff reintroduces "${hit}", which this rejected decision forbids.`, 0.5));
  }
  return out;
}

function clamp(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}
