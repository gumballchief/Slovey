import { decisionEdges, decisions, decisionVersions, getDb } from "@company-brain/db";
import { and, desc, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { getEmbeddings } from "../embeddings";
import {
  ACTIVE_STATUSES,
  isActiveStatus,
  type CreateDecisionInput,
  type DecisionReview,
  type DecisionRow,
  type DecisionStatus,
  type EdgeRow,
  type EdgeTarget,
  type EdgeType,
  type ScopeQuery,
} from "./types";

/** Below this confidence an extracted decision is a Candidate, never truth. */
export const CANDIDATE_THRESHOLD = 0.6;
/** Confidence half-life (days) for freshness decay. */
const FRESHNESS_HALF_LIFE_DAYS = 365;

function embedText(d: {
  title?: string | null;
  decision: string;
  why?: string | null;
  examples?: string[];
}): string {
  return [d.title, d.decision, d.why, (d.examples ?? []).join(" ")]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pure freshness score 0..1: confidence decayed by age, lifted by human review,
 * zeroed for non-active (retired/rejected) decisions. Testable without a DB.
 */
export function freshnessScore(d: {
  status: DecisionRow["status"];
  confidence: number;
  review: DecisionRow["review"];
  updatedAt: Date;
  now?: Date;
}): number {
  if (!isActiveStatus(d.status)) return 0;
  const ageDays = ((d.now ?? new Date()).getTime() - d.updatedAt.getTime()) / 86_400_000;
  const decay = Math.pow(0.5, Math.max(0, ageDays) / FRESHNESS_HALF_LIFE_DAYS);
  let score = d.confidence * decay;
  if (d.review === "confirmed") score = Math.min(1, score + 0.25);
  else if (d.review === "needs_changes") score *= 0.5;
  return Math.max(0, Math.min(1, score));
}

async function snapshot(decisionId: string, version: number, row: DecisionRow, by?: string, note?: string) {
  const db = getDb();
  await db.insert(decisionVersions).values({
    decisionId,
    version,
    snapshot: row as unknown as Record<string, unknown>,
    changedBy: by ?? null,
    changeNote: note ?? null,
  });
}

/** Create a decision (graph node) + v1 snapshot. Low confidence ⇒ Candidate. */
export async function createDecision(
  repoId: string,
  input: CreateDecisionInput,
): Promise<DecisionRow> {
  const db = getDb();
  const confidence = input.confidence ?? 0.5;
  const status =
    input.status ?? (confidence < CANDIDATE_THRESHOLD ? "candidate" : "approved");
  const embedding = await getEmbeddings().embedOne(embedText(input));

  const [row] = await db
    .insert(decisions)
    .values({
      repoId,
      title: input.title ?? null,
      summary: input.summary ?? null,
      decision: input.decision,
      why: input.why ?? "",
      examples: input.examples ?? [],
      evidence: input.evidence,
      source: input.source,
      category: input.category ?? null,
      status,
      ownerUser: input.ownerUser ?? null,
      owningTeam: input.owningTeam ?? null,
      importance: input.importance ?? "medium",
      priority: input.priority ?? 0,
      confidence,
      review: "unreviewed",
      domains: input.domains ?? [],
      services: input.services ?? [],
      affectedRepos: input.affectedRepos ?? [],
      directories: input.directories ?? [],
      languages: input.languages ?? [],
      frameworks: input.frameworks ?? [],
      rejectionReason: input.rejectionReason ?? null,
      alternatives: input.alternatives ?? [],
      approvedAt: status === "approved" ? new Date() : null,
      embedding,
      createdBy: input.createdBy ?? "graph",
    })
    .returning();
  if (!row) throw new Error("createDecision failed");
  await snapshot(row.id, 1, row, input.createdBy, "created");
  return row;
}

export interface DecisionWithEdges {
  decision: DecisionRow;
  outgoing: EdgeRow[];
  incoming: EdgeRow[];
  versions: number;
}

/** Full decision view: the node + its edges in/out + version count. */
export async function getDecision(repoId: string, id: string): Promise<DecisionWithEdges | null> {
  const db = getDb();
  const [decision] = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (!decision) return null;
  const [outgoing, incoming, vers] = await Promise.all([
    db.select().from(decisionEdges).where(eq(decisionEdges.fromDecisionId, id)),
    db.select().from(decisionEdges).where(eq(decisionEdges.toDecisionId, id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(decisionVersions)
      .where(eq(decisionVersions.decisionId, id)),
  ]);
  return { decision, outgoing, incoming, versions: vers[0]?.n ?? 0 };
}

/** Patch a decision: bump version, snapshot, re-embed if the text changed. */
export async function updateDecision(
  repoId: string,
  id: string,
  patch: Partial<CreateDecisionInput>,
  changedBy?: string,
  note?: string,
): Promise<DecisionRow | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (!current) return null;

  const textChanged =
    patch.decision !== undefined ||
    patch.title !== undefined ||
    patch.why !== undefined ||
    patch.examples !== undefined;
  // Increment version atomically in SQL, not current.version+1 computed in JS
  // between the SELECT above and this UPDATE — two concurrent writers would
  // otherwise both write the same version and duplicate the history snapshot.
  const set: Record<string, unknown> = {
    ...patch,
    updatedAt: new Date(),
    version: sql`${decisions.version} + 1`,
  };
  if (textChanged) {
    set.embedding = await getEmbeddings().embedOne(
      embedText({
        title: patch.title ?? current.title,
        decision: patch.decision ?? current.decision,
        why: patch.why ?? current.why,
        examples: patch.examples ?? current.examples,
      }),
    );
  }
  const [row] = await db
    .update(decisions)
    .set(set)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning();
  if (row) await snapshot(id, row.version, row, changedBy, note);
  return row ?? null;
}

/** Move a decision through its lifecycle, recording a version. */
export async function transitionStatus(
  repoId: string,
  id: string,
  status: DecisionRow["status"],
  opts: { supersededById?: string; rejectionReason?: string; by?: string } = {},
): Promise<DecisionRow | null> {
  // Bump the version (atomically) so the status change gets its own history
  // snapshot — previously version was omitted, so the snapshot re-used the
  // decision's current version number, producing duplicate version rows.
  const set: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
    version: sql`${decisions.version} + 1`,
  };
  if (status === "approved") set.approvedAt = new Date();
  if (status === "superseded" && opts.supersededById) set.supersededById = opts.supersededById;
  if (status === "rejected" && opts.rejectionReason) set.rejectionReason = opts.rejectionReason;
  const db = getDb();
  const [row] = await db
    .update(decisions)
    .set(set)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning();
  if (row) await snapshot(id, row.version, row, opts.by, `status → ${status}`);
  return row ?? null;
}

/** Add a typed, confidence-weighted edge from a decision to a decision or entity. */
export async function addEdge(
  repoId: string,
  fromDecisionId: string,
  type: EdgeType,
  target: EdgeTarget,
  opts: { confidence?: number; provenance?: unknown } = {},
): Promise<EdgeRow> {
  const db = getDb();
  const [row] = await db
    .insert(decisionEdges)
    .values({
      repoId,
      fromDecisionId,
      type,
      toDecisionId: "decisionId" in target ? target.decisionId : null,
      toEntityType: "entityType" in target ? target.entityType : null,
      toEntityRef: "entityType" in target ? target.entityRef : null,
      confidence: opts.confidence ?? 1,
      provenance: (opts.provenance as Record<string, unknown>) ?? null,
    })
    .returning();
  if (!row) throw new Error("addEdge failed");
  return row;
}

export interface TraversalResult {
  nodes: DecisionRow[];
  edges: EdgeRow[];
}

/**
 * BFS from a decision across decision→decision edges (both directions),
 * depth-limited. The backbone of "show everything related to this decision".
 */
export async function traverse(
  repoId: string,
  startId: string,
  opts: { depth?: number; types?: EdgeType[] } = {},
): Promise<TraversalResult> {
  const db = getDb();
  const depth = opts.depth ?? 2;
  const seen = new Set<string>([startId]);
  const edges: EdgeRow[] = [];
  let frontier = [startId];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const rows = await db
      .select()
      .from(decisionEdges)
      .where(
        and(
          eq(decisionEdges.repoId, repoId),
          or(
            inArray(decisionEdges.fromDecisionId, frontier),
            inArray(decisionEdges.toDecisionId, frontier),
          ),
        ),
      );
    const next: string[] = [];
    for (const e of rows) {
      if (opts.types && !opts.types.includes(e.type)) continue;
      edges.push(e);
      for (const nid of [e.fromDecisionId, e.toDecisionId]) {
        if (nid && !seen.has(nid)) {
          seen.add(nid);
          next.push(nid);
        }
      }
    }
    frontier = next;
  }

  const ids = [...seen];
  const nodes = ids.length
    ? await db.select().from(decisions).where(inArray(decisions.id, ids))
    : [];
  // de-dupe edges by id
  const uniqEdges = [...new Map(edges.map((e) => [e.id, e])).values()];
  return { nodes, edges: uniqEdges };
}

/** Version history, newest first. */
export async function timeline(repoId: string, id: string) {
  const db = getDb();
  const owner = await db
    .select({ id: decisions.id })
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (owner.length === 0) return [];
  return db
    .select()
    .from(decisionVersions)
    .where(eq(decisionVersions.decisionId, id))
    .orderBy(desc(decisionVersions.version));
}

// ── Human review loop ──────────────────────────────────────────────────────
// AI-extracted decisions enter as `proposed` (active, so the reviewer still uses
// them) but `review = unreviewed`. A human confirms (→ approved, reinforced) or
// rejects (→ rejected = negative knowledge). This is what makes the *graph*, not
// the PR comment, the system of record.

/** Pure: does a decision need human review? (Unconfirmed and still in play.) */
export function isReviewable(status: DecisionStatus, review: DecisionReview): boolean {
  return review === "unreviewed" && ["candidate", "proposed", "approved"].includes(status);
}

/** The review queue: unconfirmed decisions, AI-proposed/candidate first. */
export async function listForReview(repoId: string, limit = 50): Promise<DecisionRow[]> {
  const db = getDb();
  return db
    .select()
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, repoId),
        eq(decisions.review, "unreviewed"),
        inArray(decisions.status, ["candidate", "proposed", "approved"]),
      ),
    )
    .orderBy(
      // unconfirmed-active (candidate/proposed) before legacy auto-approved
      sql`case when ${decisions.status} in ('candidate','proposed') then 0 else 1 end`,
      desc(decisions.createdAt),
    )
    .limit(limit);
}

export type ReviewAction = "approve" | "reject";

/**
 * Resolve a decision under review. Approve ⇒ confirmed + promoted to approved +
 * reinforced (confidence bump, freshness refresh). Reject ⇒ rejected (negative
 * knowledge, surfaced by canI / getRejectedKnowledge). Every transition is
 * versioned.
 */
export async function reviewDecision(
  repoId: string,
  id: string,
  action: ReviewAction,
  opts: { by?: string; reason?: string } = {},
): Promise<DecisionRow | null> {
  if (action === "reject") {
    return transitionStatus(repoId, id, "rejected", { rejectionReason: opts.reason, by: opts.by });
  }
  const db = getDb();
  const [current] = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (!current) return null;
  const [row] = await db
    .update(decisions)
    .set({
      status: "approved",
      review: "confirmed",
      approvedAt: current.approvedAt ?? new Date(),
      updatedAt: new Date(),
      confidence: sql`least(0.99, ${decisions.confidence} + 0.1)`,
      version: sql`${decisions.version} + 1`,
    })
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning();
  if (row) await snapshot(id, row.version, row, opts.by, "reviewed → approved");
  return row ?? null;
}

/** Deterministic conflict pairs: decisions joined by a contradicts/conflicts edge. */
export async function listConflictEdges(repoId: string): Promise<EdgeRow[]> {
  const db = getDb();
  return db
    .select()
    .from(decisionEdges)
    .where(
      and(
        eq(decisionEdges.repoId, repoId),
        inArray(decisionEdges.type, ["contradicts", "conflicts_with"]),
      ),
    );
}

/** Active decisions whose scope intersects the query — the core of the Context API. */
export async function activeDecisionsForScope(
  repoId: string,
  scope: ScopeQuery,
  limit = 40,
): Promise<DecisionRow[]> {
  const db = getDb();
  // Fetch active decisions for the repo, then score scope relevance in JS (more
  // flexible than SQL for directory-prefix matching; counts are bounded).
  // Exclude the 1024-dim embedding (≈8KB/row, unused here): selecting it for
  // every active decision pulled ~32MB into the small-pool worker on this hot
  // path. Overriding the column with NULL keeps the DecisionRow shape intact.
  const rows = await db
    .select({ ...getTableColumns(decisions), embedding: sql<number[] | null>`null` })
    .from(decisions)
    .where(and(eq(decisions.repoId, repoId), inArray(decisions.status, ACTIVE_STATUSES)));

  const paths = scope.paths ?? [];
  const scored = rows
    .map((r) => ({ r, score: scopeScore(r, scope, paths) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.r);
}

/** Pure: how strongly a decision's scope matches a query (0 = no match). */
export function scopeScore(
  d: Pick<DecisionRow, "services" | "domains" | "languages" | "frameworks" | "directories">,
  scope: ScopeQuery,
  paths: string[],
): number {
  const overlap = (a: string[], b?: string[]) =>
    !b || b.length === 0 ? 0 : a.filter((x) => b.map((y) => y.toLowerCase()).includes(x.toLowerCase())).length;

  let score = 0;
  score += overlap(d.services, scope.services) * 3;
  score += overlap(d.domains, scope.domains) * 2;
  score += overlap(d.frameworks, scope.frameworks) * 2;
  score += overlap(d.languages, scope.languages) * 1;
  score += overlap(d.directories, scope.directories) * 2;
  // directory-prefix match against changed paths
  for (const dir of d.directories) {
    const norm = dir.replace(/\/+$/, "").toLowerCase();
    if (norm && paths.some((p) => p.toLowerCase().startsWith(norm))) score += 2;
  }
  return score;
}
