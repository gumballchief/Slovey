import { freshnessScore } from "../graph/service";
import { isActiveStatus, type DecisionRow } from "../graph/types";

/** The fields the memory engine scores over (a subset of a decision row). */
export type Scorable = {
  status: DecisionRow["status"];
  confidence: number;
  review: DecisionRow["review"];
  updatedAt: Date;
  now?: Date;
  source: string;
  importance: string;
  evidence: string[];
};

// Authority of a source, 0..1 — how much a decision drawn from it should be
// trusted. Human-entered > merged engineering evidence > docs/ADRs > inferred
// from code/tickets > chat discussion. (Mirrors the reasoning authority order;
// there is no "production code" source enum yet, so manual = highest human authority.)
const AUTHORITY: Record<string, number> = {
  manual: 0.95,
  github_pr: 0.85,
  doc: 0.75,
  repo_analysis: 0.6,
  jira: 0.6,
  linear: 0.6,
  confluence: 0.6,
  notion: 0.6,
  slack: 0.45,
  discord: 0.45,
};

/** Pure authority weight of a decision source (0..1). Unknown ⇒ 0.5. */
export function authorityRank(source: string): number {
  return AUTHORITY[source] ?? 0.5;
}

const IMPORTANCE_WEIGHT: Record<string, number> = {
  critical: 1,
  high: 0.8,
  medium: 0.6,
  low: 0.4,
};

/**
 * Durability score 0..1 — how strongly a memory should persist and lead
 * retrieval. Pure + testable. Freshness already folds in confidence, human
 * review and time-decay; we blend it with authority, importance and evidence
 * volume. Retired/rejected memories score 0 (they no longer govern).
 */
export function memoryScore(d: Scorable): number {
  if (!isActiveStatus(d.status)) return 0;
  const fresh = freshnessScore(d);
  const authority = authorityRank(d.source);
  const importance = IMPORTANCE_WEIGHT[d.importance] ?? 0.6;
  const evidence = Math.min(1, (d.evidence?.length ?? 0) / 3); // 3+ pieces ⇒ full
  const score = fresh * 0.4 + authority * 0.2 + importance * 0.2 + evidence * 0.2;
  return Math.max(0, Math.min(1, score));
}

export type MemoryLayer = "long_term" | "working" | "short_term";

export interface MemoryFlags {
  /** Coarse layer: enduring principles vs active work vs unverified/transient. */
  layer: MemoryLayer;
  score: number;
  /** High durability — should persist; leads retrieval. */
  durable: boolean;
  /** Active but decayed — likely needs re-confirmation. */
  stale: boolean;
  /** False-memory candidate: low confidence and no evidence. */
  weak: boolean;
  /** Freshness slipping but not yet stale — watch. */
  decaying: boolean;
}

const STALE = 0.3;
const DECAYING = 0.5;
const DURABLE = 0.6;

/** Pure health classification of a single memory. */
export function classifyMemory(d: Scorable): MemoryFlags {
  const fresh = freshnessScore(d);
  const score = memoryScore(d);
  const active = isActiveStatus(d.status);
  const evidence = d.evidence?.length ?? 0;

  const layer: MemoryLayer =
    d.importance === "critical" || d.importance === "high"
      ? "long_term"
      : d.status === "candidate" || d.status === "proposed"
        ? "short_term"
        : "working";

  return {
    layer,
    score: Number(score.toFixed(2)),
    durable: score >= DURABLE,
    stale: active && fresh < STALE,
    weak: active && d.confidence < 0.5 && evidence === 0,
    decaying: active && fresh >= STALE && fresh < DECAYING,
  };
}
