import { decisions, getDb } from "@company-brain/db";
import { eq, sql } from "drizzle-orm";
import { governanceReport, type GovernanceReport } from "../graph/governance";
import { ACTIVE_STATUSES, isActiveStatus } from "../graph/types";
import { classifyMemory, memoryScore, type MemoryLayer } from "./score";

/** Cosine distance below which two decisions are near-duplicate memories. */
const DUPLICATE_DISTANCE = 0.15;

export interface DuplicatePair {
  aId: string;
  bId: string;
  a: string;
  b: string;
  distance: number;
}

export interface MemoryHealth {
  total: number;
  active: number;
  /** Mean durability over active memories (0..1) — the org's "memory trust". */
  durability: number;
  /** How many active memories sit in each layer. */
  layers: Record<MemoryLayer, number>;
  freshness: { fresh: number; aging: number; stale: number };
  /** False-memory candidates: active, low confidence, no evidence. */
  weak: Array<{ id: string; decision: string }>;
  /** Near-duplicate pairs — consolidation candidates. */
  duplicates: DuplicatePair[];
  /** Decisions explicitly marked contradicting/conflicting. */
  conflicts: number;
  /** Reinforcement state of active memories. */
  reinforcement: { confirmed: number; unreviewed: number; needsChanges: number };
  /** Plain-language, evidence-backed next actions. */
  recommendations: string[];
  governance: GovernanceReport;
}

/**
 * Memory health — does the graph behave like durable organizational memory?
 * Composes governance (drift) with memory-specific signals: durability,
 * freshness distribution, layer mix, near-duplicates (consolidation), weak
 * (false-memory) candidates, and reinforcement state. Read-only; recommends,
 * never mutates.
 */
export async function memoryHealth(repoId: string): Promise<MemoryHealth> {
  const db = getDb();
  const rows = await db.select().from(decisions).where(eq(decisions.repoId, repoId));

  const layers: Record<MemoryLayer, number> = { long_term: 0, working: 0, short_term: 0 };
  const freshness = { fresh: 0, aging: 0, stale: 0 };
  const reinforcement = { confirmed: 0, unreviewed: 0, needsChanges: 0 };
  const weak: MemoryHealth["weak"] = [];
  let scoreSum = 0;
  let activeCount = 0;

  for (const r of rows) {
    if (!isActiveStatus(r.status)) continue;
    activeCount++;
    const flags = classifyMemory(r);
    layers[flags.layer]++;
    scoreSum += memoryScore(r);
    if (flags.stale) freshness.stale++;
    else if (flags.decaying) freshness.aging++;
    else freshness.fresh++;
    if (flags.weak) weak.push({ id: r.id, decision: r.decision });
    if (r.review === "confirmed") reinforcement.confirmed++;
    else if (r.review === "needs_changes") reinforcement.needsChanges++;
    else reinforcement.unreviewed++;
  }

  const duplicates = await findDuplicates(repoId);
  const governance = await governanceReport(repoId);

  const durability = activeCount ? Number((scoreSum / activeCount).toFixed(2)) : 0;
  const recommendations = buildRecommendations({
    durability,
    stale: freshness.stale,
    weak: weak.length,
    duplicates: duplicates.length,
    conflicts: governance.conflicts.length,
    unreviewed: reinforcement.unreviewed,
  });

  return {
    total: rows.length,
    active: activeCount,
    durability,
    layers,
    freshness,
    weak: weak.slice(0, 50),
    duplicates,
    conflicts: governance.conflicts.length,
    reinforcement,
    recommendations,
    governance,
  };
}

/** Cap on outer rows fed to the KNN scan — bounds work regardless of repo size. */
const DUPLICATE_MAX_CANDIDATES = 200;
/** Nearest neighbours checked per candidate row via the pgvector index. */
const DUPLICATE_NEIGHBORS_PER_ROW = 5;
const DUPLICATE_CACHE_TTL_MS = 60_000;
const duplicateCache = new Map<string, { expiresAt: number; pairs: DuplicatePair[] }>();

/**
 * Near-duplicate active memories via a per-row LATERAL KNN scan (bounded).
 * Each candidate row asks the pgvector index for its few nearest neighbours
 * instead of comparing every pair, the outer input is capped to the most
 * recent candidates, and results are cached briefly per repo.
 */
async function findDuplicates(repoId: string): Promise<DuplicatePair[]> {
  const cached = duplicateCache.get(repoId);
  if (cached && cached.expiresAt > Date.now()) return cached.pairs;
  const db = getDb();
  const raw: unknown = await db.execute(sql`
    SELECT a.id AS "aId", nb.id AS "bId", a.decision AS "a", nb.decision AS "b", nb.distance AS "distance"
    FROM (
      SELECT id, decision, embedding FROM decisions
      WHERE repo_id = ${repoId}
        AND status IN ('approved', 'proposed')
        AND embedding IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT ${DUPLICATE_MAX_CANDIDATES}
    ) a
    CROSS JOIN LATERAL (
      SELECT d.id, d.decision, (a.embedding <=> d.embedding) AS distance
      FROM decisions d
      WHERE d.repo_id = ${repoId}
        AND d.id > a.id
        AND d.status IN ('approved', 'proposed')
        AND d.embedding IS NOT NULL
      ORDER BY a.embedding <=> d.embedding
      LIMIT ${DUPLICATE_NEIGHBORS_PER_ROW}
    ) nb
    WHERE nb.distance < ${DUPLICATE_DISTANCE}
    ORDER BY nb.distance
    LIMIT 25
  `);
  const list: unknown[] = Array.isArray(raw) ? raw : ((raw as { rows: unknown[] }).rows ?? []);
  const pairs = (list as Array<{ aId: string; bId: string; a: string; b: string; distance: number }>).map((r) => ({
    ...r,
    distance: Number(Number(r.distance).toFixed(3)),
  }));
  duplicateCache.set(repoId, { expiresAt: Date.now() + DUPLICATE_CACHE_TTL_MS, pairs });
  return pairs;
}

function buildRecommendations(x: {
  durability: number;
  stale: number;
  weak: number;
  duplicates: number;
  conflicts: number;
  unreviewed: number;
}): string[] {
  const out: string[] = [];
  if (x.conflicts > 0) out.push(`Resolve ${x.conflicts} conflicting decision pair(s) — contradictory memory erodes trust.`);
  if (x.duplicates > 0) out.push(`Consolidate ${x.duplicates} near-duplicate memory pair(s) into single, stronger decisions.`);
  if (x.weak > 0) out.push(`Review ${x.weak} weak memory(ies) (low confidence, no evidence) — confirm with evidence or archive.`);
  if (x.stale > 0) out.push(`Re-confirm ${x.stale} stale decision(s) whose freshness has decayed.`);
  if (x.unreviewed > 0) out.push(`${x.unreviewed} active decision(s) are unconfirmed — a human confirmation reinforces them.`);
  if (out.length === 0) out.push("Memory is healthy: no conflicts, duplicates, or stale decisions detected.");
  return out;
}
