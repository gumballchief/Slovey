import { decisions, getDb } from "@company-brain/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getAI } from "../ai";
import { getEmbeddings } from "../embeddings";
import { freshnessScore } from "../graph/service";
import type { DecisionRow } from "../graph/types";
import { reinforce } from "../memory/reinforce";
import type { AnswerConfidence, Citation, ReasonedAnswer } from "./types";

// Statuses the engine reasons over: active + queryable history (so "why was X
// rejected?" / "what replaced ADR-17?" work). Candidates (unverified) and
// legacy 'removed' are excluded — we never answer from unverified claims.
const QUERYABLE: DecisionRow["status"][] = [
  "approved",
  "proposed",
  "rejected",
  "deprecated",
  "superseded",
];

// Cosine distance above which the closest decision is too weak to cite. Beyond
// this the engine stays silent rather than inventing an answer.
const SILENCE_DISTANCE = 0.55;
const TOP_K = 8;

export interface Ranked {
  row: DecisionRow;
  distance: number;
  freshness: number;
  rank: number;
}

/**
 * Retrieve + rank queryable decisions for a query (similarity×freshness).
 * Shared primitive: the reasoner, CanI, and other Decision-API verbs all use it.
 */
export async function retrieveRanked(repoId: string, query: string): Promise<Ranked[]> {
  const vec = await getEmbeddings().embedOne(query);
  const lit = `[${vec.join(",")}]`;
  const db = getDb();
  const rows = await db
    .select({
      row: decisions,
      distance: sql<number>`(${decisions.embedding} <=> ${lit}::vector)`,
    })
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, repoId),
        inArray(decisions.status, QUERYABLE),
        sql`${decisions.embedding} is not null`,
      ),
    )
    .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
    .limit(TOP_K);

  return rows.map(({ row, distance }) => {
    const freshness = freshnessScore(row);
    // similarity (1-distance) blended with freshness; rejected/retired kept but
    // down-weighted so active decisions lead.
    const similarity = 1 - distance;
    const rank = similarity * 0.7 + freshness * 0.3;
    return { row, distance, freshness, rank };
  }).sort((a, b) => b.rank - a.rank);
}

export function toCitation(r: Ranked): Citation {
  return {
    decisionId: r.row.id,
    title: r.row.title ?? r.row.decision.slice(0, 80),
    decision: r.row.decision,
    status: r.row.status,
    evidence: r.row.evidence ?? [],
    freshness: Number(r.freshness.toFixed(2)),
  };
}

/**
 * Answer an engineering question from the decision graph. The LLM is a reasoner
 * over collected, ranked evidence — not a free-form answerer. Citation-or-silence:
 * with no sufficiently-relevant decision, it declines instead of hallucinating.
 */
export async function reason(repoId: string, question: string): Promise<ReasonedAnswer> {
  const reasoning: string[] = [];
  const ranked = await retrieveRanked(repoId, question);
  reasoning.push(`Retrieved ${ranked.length} candidate decisions from the graph.`);

  const closest = ranked[0];
  if (!closest || closest.distance > SILENCE_DISTANCE) {
    reasoning.push(
      `Closest decision distance ${closest ? closest.distance.toFixed(2) : "n/a"} exceeds the silence threshold ${SILENCE_DISTANCE}; declining.`,
    );
    return {
      question,
      answer: "No recorded engineering decision addresses this. (Nothing in the decision graph matched closely enough to answer with evidence.)",
      confidence: "none",
      citations: [],
      reasoning,
    };
  }

  const considered = ranked.slice(0, 6);
  reasoning.push(
    `Ranked by similarity×freshness; resolved lifecycle (superseded/deprecated/rejected down-weighted). Using top ${considered.length}.`,
  );

  const numbered = considered
    .map((r, i) => {
      const meta = `status=${r.row.status}, importance=${r.row.importance}, freshness=${r.freshness.toFixed(2)}, evidence=${(r.row.evidence ?? []).join(", ") || "—"}`;
      const extra =
        r.row.status === "rejected" && r.row.rejectionReason
          ? `\n   rejected because: ${r.row.rejectionReason}` +
            (r.row.alternatives?.length ? `; instead: ${r.row.alternatives.join(", ")}` : "")
          : "";
      return `[${i + 1}] ${r.row.decision}\n   why: ${r.row.why || "—"}\n   (${meta})${extra}`;
    })
    .join("\n\n");

  const prompt = `You are the engineering decision brain for a team. Answer the question USING ONLY the decisions below. Cite the decisions you use by their [number]. If the decisions do not actually answer the question, say so plainly — do NOT invent or generalize. Prefer active decisions over superseded/deprecated ones, and surface rejected approaches when relevant ("we tried X, rejected because…").

QUESTION: ${question}

DECISIONS:
${numbered}

Respond ONLY with JSON: {"answer": "<concise answer citing [n]>", "used": [<numbers actually cited>], "confidence": "high|medium|low"}`;

  const res = await getAI().completeJSON<{ answer: string; used: number[]; confidence: string }>(
    prompt,
    { tier: "premium", maxTokens: 500 },
  );

  if (!res || !res.answer) {
    reasoning.push("Reasoner returned no parseable answer.");
    return {
      question,
      answer: "Unable to produce a grounded answer from the decision graph right now.",
      confidence: "none",
      citations: [],
      reasoning,
    };
  }

  const usedIdx = (res.used ?? []).filter((n) => n >= 1 && n <= considered.length);
  // If the reasoner grounded the answer in NO decision, do not fabricate a
  // citation — that would fake evidence. An ungrounded answer is, at best, a
  // soft decline: show no citation and never claim high confidence.
  const citations = usedIdx.map((n) => considered[n - 1]!).map(toCitation);
  reasoning.push(
    citations.length
      ? `Reasoner cited ${citations.length} decision(s).`
      : "Reasoner used no decision; answer is not grounded in recorded evidence.",
  );

  // Reinforcement: a citation is weak evidence the decision is still relevant.
  // Bounded confidence nudge (never resets freshness); failures never break the
  // answer. Knowledge strengthens through use.
  await Promise.all(
    citations.map((c) => reinforce(repoId, c.decisionId, "referenced").catch(() => undefined)),
  );

  let conf: AnswerConfidence =
    res.confidence === "high" || res.confidence === "medium" || res.confidence === "low"
      ? res.confidence
      : "medium";
  // Never fake confidence: an answer with no citation cannot be high-confidence.
  if (citations.length === 0) conf = "low";

  return { question, answer: res.answer, confidence: conf, citations, reasoning };
}
