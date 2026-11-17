import {
  agentRuns,
  auditLogs,
  decisions,
  feedback as feedbackTable,
  getDb,
  installations,
  memberships,
  organizations,
  prChecks,
  repoKnowledge,
  repoSettings,
  repos,
  users,
} from "@company-brain/db";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { tryEmbed } from "../embeddings/try";
import { lexicalDistance, lexicalTerms } from "../pipelines/lexical";
import { applyMeaning, pickByMeaning } from "../pipelines/meaning";
import { reinforce } from "../memory";
import { enqueue, JOBS } from "../queue";

// ── API shapes (match apps/web/lib/data.ts exactly so they're drop-in) ──
export interface ApiDecision {
  id: string;
  decision: string;
  why: string;
  examples: string[];
  evidence: string[];
  source: (typeof decisions.$inferSelect)["source"];
  status?: Exclude<(typeof decisions.$inferSelect)["status"], "removed">;
  createdAt: string;
  repoId: string;
}

export interface ApiCheckedPR {
  number: number;
  title: string;
  author: string;
  verdict: "conflict" | "clear";
  matchedDecision?: string;
  matchedDecisionId?: string;
  citation?: string;
  postedComment?: string;
  severity?: string;
  suggestedFix?: string;
  checkedAt: string;
  repoId: string;
}

export interface ApiRepo {
  id: string;
  name: string;
  org: string;
  decisionsCount: number;
  prsChecked: number;
  conflictsCaught: number;
  reviewTimeSaved: string;
  trend: { week: string; conflicts: number; clears: number }[];
}

// ── mappers ──
function toApiDecision(
  d: Pick<
    typeof decisions.$inferSelect,
    "id" | "repoId" | "decision" | "why" | "examples" | "evidence" | "source" | "status" | "createdAt"
  >,
): ApiDecision {
  return {
    id: d.id,
    decision: d.decision,
    why: d.why,
    examples: d.examples ?? [],
    evidence: d.evidence ?? [],
    source: d.source,
    status: d.status === "removed" ? undefined : d.status,
    createdAt: d.createdAt.toISOString(),
    repoId: d.repoId,
  };
}

function toApiCheck(
  c: typeof prChecks.$inferSelect,
  matchedDecisionText?: string | null,
  citation?: string | null,
): ApiCheckedPR {
  return {
    number: c.prNumber,
    title: c.prTitle,
    author: c.prAuthor,
    verdict: c.verdict === "conflict" ? "conflict" : "clear",
    matchedDecision: matchedDecisionText ?? undefined,
    matchedDecisionId: c.matchedDecisionId ?? undefined,
    // Citation lives on the matched decision; populated by callers that join it.
    citation: citation ?? undefined,
    postedComment: c.explanation ?? undefined,
    severity: c.severity ?? undefined,
    suggestedFix: c.suggestedFix ?? undefined,
    checkedAt: c.checkedAt.toISOString(),
    repoId: c.repoId,
  };
}

// ── repo stats ──
async function repoStats(repoId: string) {
  const db = getDb();
  const [d] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(decisions)
    .where(and(eq(decisions.repoId, repoId), inArray(decisions.status, ["approved", "proposed"])));
  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(prChecks)
    .where(eq(prChecks.repoId, repoId));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(prChecks)
    .where(and(eq(prChecks.repoId, repoId), eq(prChecks.verdict, "conflict")));
  const conflicts = c?.n ?? 0;
  const hours = Math.round(conflicts * 1.5 + (p?.n ?? 0) * 0.05);
  return {
    decisionsCount: d?.n ?? 0,
    prsChecked: p?.n ?? 0,
    conflictsCaught: conflicts,
    reviewTimeSaved: `${hours}h`,
  };
}

/** Bucket raw check rows into the 6-week trend shape the dashboard renders. */
function bucketTrend(rows: { verdict: string; checkedAt: Date }[]) {
  const weeks = new Map<number, { conflicts: number; clears: number }>();
  for (let i = 5; i >= 0; i--) weeks.set(i, { conflicts: 0, clears: 0 });
  const now = Date.now();
  for (const r of rows) {
    const ageDays = (now - r.checkedAt.getTime()) / 86_400_000;
    const bucket = 5 - Math.min(5, Math.floor(ageDays / 7));
    const w = weeks.get(bucket);
    if (!w) continue;
    if (r.verdict === "conflict") w.conflicts++;
    else if (r.verdict === "clear") w.clears++;
  }
  return [...weeks.entries()].map(([i, v]) => ({ week: `W${i + 1}`, ...v }));
}

async function repoTrend(repoId: string) {
  const db = getDb();
  const rows = await db
    .select({ verdict: prChecks.verdict, checkedAt: prChecks.checkedAt })
    .from(prChecks)
    .where(
      and(
        eq(prChecks.repoId, repoId),
        sql`${prChecks.checkedAt} > now() - interval '42 days'`,
      ),
    );
  return bucketTrend(rows);
}

/** Which repos a viewer may see: ones they own (by GitHub id, or login for
 *  un-backfilled rows) or belong to via an org membership. */
export interface RepoScope {
  githubId?: number;
  login: string;
  orgIds: string[];
}

/** Pure visibility check mirroring listRepos(): owner (id or login) or org membership. */
export function isRepoVisible(
  repo: { ownerGithubId?: number | null; owner?: string | null; orgId?: string | null },
  scope?: RepoScope,
): boolean {
  if (!scope) return true;
  if (scope.githubId != null && repo.ownerGithubId === scope.githubId) return true;
  if (
    typeof repo.owner === "string" &&
    repo.owner.toLowerCase() === (scope.login ?? "").toLowerCase()
  )
    return true;
  if (repo.orgId && scope.orgIds.includes(repo.orgId)) return true;
  return false;
}

/** Reject repos outside the caller's tenancy. No scope = dev/local (allow). */
export async function requireRepoScope(repoId: string, scope?: RepoScope): Promise<void> {
  if (!scope) return;
  const db = getDb();
  const [r] = await db
    .select({ ownerGithubId: repos.ownerGithubId, owner: repos.owner, orgId: installations.orgId })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  if (!r || !isRepoVisible(r, scope)) throw new Error("repo not visible to caller");
}

/** Reject orgs outside the caller's tenancy. No scope = dev/local (allow). */
export async function requireOrgScope(orgId: string, scope?: RepoScope): Promise<void> {
  if (!scope) return;
  if (!scope.orgIds.includes(orgId)) throw new Error("org not visible to caller");
}

export async function listRepos(scope?: RepoScope): Promise<ApiRepo[]> {
  const db = getDb();
  // TENANCY: without scoping, this returned EVERY tenant's repos (names + metrics)
  // to any authenticated user. When a scope is passed, restrict to repos the
  // viewer owns or is an org member of. No scope = dev/local (returns all).
  const visible = scope
    ? or(
        scope.githubId != null ? eq(repos.ownerGithubId, scope.githubId) : undefined,
        sql`lower(${repos.owner}) = lower(${scope.login})`,
        scope.orgIds.length ? inArray(installations.orgId, scope.orgIds) : undefined,
      )
    : undefined;
  // Grouped aggregates instead of 4 queries per repo: the per-repo loop was an
  // N+1 that exhausted the connection pool under concurrent load (each request
  // fired ~4×N sequential round-trips; 100 concurrent users → 30s+ tails).
  const [rows, decisionCounts, checkCounts, trendRows] = await Promise.all([
    db
      .select({
        id: repos.id,
        fullName: repos.fullName,
        owner: repos.owner,
        accountLogin: installations.accountLogin,
      })
      .from(repos)
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(visible),
    db
      .select({ repoId: decisions.repoId, n: sql<number>`count(*)::int` })
      .from(decisions)
      .innerJoin(repos, eq(decisions.repoId, repos.id))
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(and(inArray(decisions.status, ["approved", "proposed"]), visible))
      .groupBy(decisions.repoId),
    db
      .select({
        repoId: prChecks.repoId,
        prs: sql<number>`count(*)::int`,
        conflicts: sql<number>`(count(*) filter (where ${prChecks.verdict} = 'conflict'))::int`,
      })
      .from(prChecks)
      .innerJoin(repos, eq(prChecks.repoId, repos.id))
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(visible)
      .groupBy(prChecks.repoId),
    db
      .select({ repoId: prChecks.repoId, verdict: prChecks.verdict, checkedAt: prChecks.checkedAt })
      .from(prChecks)
      .innerJoin(repos, eq(prChecks.repoId, repos.id))
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(and(sql`${prChecks.checkedAt} > now() - interval '42 days'`, visible)),
  ]);

  const decByRepo = new Map(decisionCounts.map((d) => [d.repoId, d.n]));
  const checksByRepo = new Map(checkCounts.map((c) => [c.repoId, c]));
  const trendByRepo = new Map<string, { verdict: string; checkedAt: Date }[]>();
  for (const t of trendRows) {
    const list = trendByRepo.get(t.repoId) ?? [];
    list.push(t);
    trendByRepo.set(t.repoId, list);
  }

  return rows.map((r) => {
    const checks = checksByRepo.get(r.id);
    const conflicts = checks?.conflicts ?? 0;
    const prs = checks?.prs ?? 0;
    return {
      id: r.id,
      name: r.fullName,
      org: r.accountLogin ?? r.owner,
      decisionsCount: decByRepo.get(r.id) ?? 0,
      prsChecked: prs,
      conflictsCaught: conflicts,
      reviewTimeSaved: `${Math.round(conflicts * 1.5 + prs * 0.05)}h`,
      trend: bucketTrend(trendByRepo.get(r.id) ?? []),
    };
  });
}

/** Org ids the user belongs to (for scoping repo listings to their tenancy). */
export async function listUserOrgIds(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return rows.map((r) => r.orgId);
}

export async function getOverview(repoId: string, scope?: RepoScope) {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const [stats, trend, recentRows] = await Promise.all([
    repoStats(repoId),
    repoTrend(repoId),
    db
      .select()
      .from(prChecks)
      .where(eq(prChecks.repoId, repoId))
      .orderBy(desc(prChecks.checkedAt))
      .limit(8),
  ]);

  // Resolve all matched-decision texts in one query (was one query per row).
  const matchedIds = [...new Set(recentRows.map((c) => c.matchedDecisionId).filter((x): x is string => Boolean(x)))];
  const textById = new Map<string, string>();
  if (matchedIds.length > 0) {
    const ds = await db
      .select({ id: decisions.id, decision: decisions.decision })
      .from(decisions)
      .where(and(inArray(decisions.id, matchedIds), eq(decisions.repoId, repoId)));
    for (const d of ds) textById.set(d.id, d.decision);
  }
  const recent: ApiCheckedPR[] = recentRows.map((c) =>
    toApiCheck(c, c.matchedDecisionId ? (textById.get(c.matchedDecisionId) ?? null) : null),
  );
  return { stats, trend, recent };
}

export async function listDecisions(
  repoId: string,
  filter: { query?: string; source?: string } = {},
  scope?: RepoScope,
): Promise<ApiDecision[]> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const conds = [eq(decisions.repoId, repoId), sql`${decisions.status} <> 'removed'`];
  if (filter.source) conds.push(eq(decisions.source, filter.source as ApiDecision["source"]));
  if (filter.query) {
    const q = `%${filter.query}%`;
    conds.push(or(ilike(decisions.decision, q), ilike(decisions.why, q))!);
  }
  const rows = await db
    .select({
      id: decisions.id,
      repoId: decisions.repoId,
      decision: decisions.decision,
      why: decisions.why,
      examples: decisions.examples,
      evidence: decisions.evidence,
      source: decisions.source,
      status: decisions.status,
      createdAt: decisions.createdAt,
    })
    .from(decisions)
    .where(and(...conds))
    .orderBy(desc(decisions.createdAt))
    .limit(1000);
  return rows.map(toApiDecision);
}

/**
 * Semantic search over a repo's decisions (pgvector cosine on the query
 * embedding). Falls back to text search when the query is empty.
 */
export async function searchDecisions(
  repoId: string,
  query: string,
  limit = 8,
  scope?: RepoScope,
): Promise<ApiDecision[]> {
  await requireRepoScope(repoId, scope);
  const q = query.trim();
  if (!q) return listDecisions(repoId, {}, scope);
  const vec = await tryEmbed(q);
  const db = getDb();
  if (!vec) {
    // Embeddings unavailable: rank by keyword overlap, dropping non-matches.
    const terms = lexicalTerms(q);
    const all = await db
      .select({
        id: decisions.id,
        repoId: decisions.repoId,
        decision: decisions.decision,
        why: decisions.why,
        examples: decisions.examples,
        evidence: decisions.evidence,
        source: decisions.source,
        status: decisions.status,
        createdAt: decisions.createdAt,
      })
      .from(decisions)
      .where(and(eq(decisions.repoId, repoId), sql`${decisions.status} <> 'removed'`))
      .orderBy(desc(decisions.updatedAt))
      .limit(500);
    const max = Math.min(Math.max(limit, 1), 50);
    // The cheap model adds decisions the search is about by meaning (synonyms).
    const picks = await pickByMeaning(
      q,
      all.map((r) => ({ id: r.id, text: r.decision })),
      max,
    );
    return applyMeaning(
      all.map((r) => ({
        id: r.id,
        r,
        distance: lexicalDistance(terms, lexicalTerms([r.decision, r.why, (r.examples ?? []).join(" ")].join("\n"))),
      })),
      picks,
    )
      .filter((x) => x.distance < 1)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, max)
      .map((x) => toApiDecision(x.r));
  }
  const lit = `[${vec.join(",")}]`;
  const rows = await db
    .select({
      id: decisions.id,
      repoId: decisions.repoId,
      decision: decisions.decision,
      why: decisions.why,
      examples: decisions.examples,
      evidence: decisions.evidence,
      source: decisions.source,
      status: decisions.status,
      createdAt: decisions.createdAt,
    })
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, repoId),
        sql`${decisions.status} <> 'removed'`,
        sql`${decisions.embedding} is not null`,
      ),
    )
    .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map(toApiDecision);
}

export async function createDecision(
  repoId: string,
  input: {
    decision: string;
    why?: string;
    examples?: string[];
    evidence: string[];
    source?: ApiDecision["source"];
    category?: string;
    createdBy?: string;
    /** "rejected" records negative knowledge — the approach the team decided against. */
    status?: "approved" | "rejected";
    rejectionReason?: string;
    /** What to use instead of the rejected approach. */
    alternatives?: string[];
  },
  scope?: RepoScope,
): Promise<ApiDecision> {
  await requireRepoScope(repoId, scope);
  const org = await getOrgForRepo(repoId);
  if (org) {
    const billing = await getBilling(org.id);
    const limit = PLAN_LIMITS[billing.plan].decisions;
    if (limit !== -1 && billing.usage.decisions >= limit) {
      throw new Error(`Decision limit reached for ${billing.plan} plan (${limit})`);
    }
  }
  const db = getDb();
  const text = [input.decision, input.why ?? "", (input.examples ?? []).join(" ")].join("\n");
  // Null when embeddings are down; backfillMissingEmbeddings fills it in later.
  const embedding = await tryEmbed(text);
  const values = {
    repoId,
    decision: input.decision,
    why: input.why ?? "",
    examples: input.examples ?? [],
    evidence: input.evidence,
    source: input.source ?? "github_pr",
    category: input.category ?? null,
    status: input.status ?? "approved",
    rejectionReason: input.rejectionReason ?? null,
    alternatives: input.alternatives ?? [],
    embedding,
    createdBy: input.createdBy ?? "dashboard",
  };
  if (org) {
    const [row] = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ plan: organizations.plan })
        .from(organizations)
        .where(eq(organizations.id, org.id))
        .for("update");
      const plan = ((locked?.plan ?? "free") as OrgPlan);
      const limit = PLAN_LIMITS[plan].decisions;
      if (limit !== -1) {
        const [c] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(decisions)
          .innerJoin(repos, eq(decisions.repoId, repos.id))
          .innerJoin(installations, eq(repos.installationId, installations.id))
          .where(and(eq(installations.orgId, org.id), ne(decisions.status, "removed")));
        if ((c?.n ?? 0) >= limit) {
          throw new Error(`Decision limit reached for ${plan} plan (${limit})`);
        }
      }
      return tx.insert(decisions).values(values).returning();
    });
    return toApiDecision(row!);
  }
  const [row] = await db
    .insert(decisions)
    .values(values)
    .returning();
  return toApiDecision(row!);
}

export async function updateDecision(
  repoId: string,
  id: string,
  patch: { decision?: string; why?: string; examples?: string[]; evidence?: string[]; status?: "approved" | "proposed" | "suggested" | "removed" },
  scope?: RepoScope,
): Promise<ApiDecision | null> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const [current] = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (!current) return null;
  const isRestore =
    current.status === "removed" && !!patch.status && patch.status !== "removed";
  let restoreOrgId: string | null = null;
  if (isRestore) {
    const org = await getOrgForRepo(repoId);
    if (org) {
      restoreOrgId = org.id;
      const billing = await getBilling(org.id);
      const limit = PLAN_LIMITS[billing.plan].decisions;
      if (limit !== -1 && billing.usage.decisions >= limit) {
        throw new Error(`Decision limit reached for ${billing.plan} plan (${limit})`);
      }
    }
  }

  const next = {
    decision: patch.decision ?? current.decision,
    why: patch.why ?? current.why,
    examples: patch.examples ?? current.examples,
    evidence: patch.evidence ?? current.evidence,
  };
  const textChanged =
    patch.decision !== undefined || patch.why !== undefined || patch.examples !== undefined;
  const set: Record<string, unknown> = { ...next, updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (textChanged) {
    const text = [next.decision, next.why, (next.examples ?? []).join(" ")].join("\n");
    set.embedding = await tryEmbed(text);
  }
  if (isRestore && restoreOrgId && typeof db.transaction === "function") {
    const orgId = restoreOrgId;
    const row = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ plan: organizations.plan })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for("update");
      const plan = ((locked?.plan ?? "free") as OrgPlan);
      const limit = PLAN_LIMITS[plan].decisions;
      if (limit !== -1) {
        const [c] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(decisions)
          .innerJoin(repos, eq(decisions.repoId, repos.id))
          .innerJoin(installations, eq(repos.installationId, installations.id))
          .where(and(eq(installations.orgId, orgId), ne(decisions.status, "removed")));
        if ((c?.n ?? 0) >= limit) {
          throw new Error(`Decision limit reached for ${plan} plan (${limit})`);
        }
      }
      const [updated] = await tx
        .update(decisions)
        .set(set)
        .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
        .returning();
      return updated;
    });
    return row ? toApiDecision(row) : null;
  }
  const [row] = await db
    .update(decisions)
    .set(set)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning();
  return row ? toApiDecision(row) : null;
}

/** Soft-delete (status='removed') so retrieval excludes it but history is kept. */
export async function removeDecision(repoId: string, id: string, scope?: RepoScope): Promise<boolean> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const rows = await db
    .update(decisions)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning({ id: decisions.id });
  return rows.length > 0;
}

export async function listPRChecks(repoId: string, scope?: RepoScope): Promise<ApiCheckedPR[]> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const rows = await db
    .select()
    .from(prChecks)
    .where(eq(prChecks.repoId, repoId))
    .orderBy(desc(prChecks.checkedAt))
    .limit(100);
  return rows.map((c) => toApiCheck(c));
}

// ── organization / team / audit ──
export interface ApiOrg {
  id: string;
  name: string;
  slug: string;
}

export interface ApiMember {
  id: string;
  login: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface ApiAuditEntry {
  id: string;
  action: string;
  actorUser: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

// ── billing ──
export type OrgPlan = "free" | "pro" | "enterprise";

export interface ApiBilling {
  plan: OrgPlan;
  usage: {
    repos: number;
    members: number;
    decisions: number;
    prsChecked: number;
    conflictsCaught: number;
  };
  /** -1 = unlimited. */
  limits: { repos: number; decisions: number };
}

export const PLAN_LIMITS: Record<OrgPlan, { repos: number; decisions: number }> = {
  free: { repos: 1, decisions: 200 },
  // Team advertises "Unlimited repositories" on the pricing page, so `pro` grants
  // it for real (-1). The decision cap stays finite and is surfaced in the UI —
  // an unadvertised silent cap is what this used to get wrong.
  pro: { repos: -1, decisions: 5000 },
  enterprise: { repos: -1, decisions: -1 },
};

/** Plan + real current usage for an org (drives the Billing page). */
export async function getBilling(orgId: string, scope?: RepoScope): Promise<ApiBilling> {
  await requireOrgScope(orgId, scope);
  const db = getDb();
  // One parallel wave (was 6 sequential round-trips — the slowest route under
  // load). Per-repo scoping happens via joins so nothing depends on a prior
  // repo-id fetch.
  const [orgRows, repoCount, members, decisionCount, checkCounts] = await Promise.all([
    db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(repos)
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(eq(installations.orgId, orgId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(eq(memberships.orgId, orgId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(decisions)
      .innerJoin(repos, eq(decisions.repoId, repos.id))
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(and(eq(installations.orgId, orgId), ne(decisions.status, "removed"))),
    db
      .select({
        prs: sql<number>`count(*)::int`,
        conflicts: sql<number>`(count(*) filter (where ${prChecks.verdict} = 'conflict'))::int`,
      })
      .from(prChecks)
      .innerJoin(repos, eq(prChecks.repoId, repos.id))
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .where(eq(installations.orgId, orgId)),
  ]);

  const plan = (orgRows[0]?.plan ?? "free") as OrgPlan;
  return {
    plan,
    usage: {
      repos: repoCount[0]?.n ?? 0,
      members: members[0]?.n ?? 0,
      decisions: decisionCount[0]?.n ?? 0,
      prsChecked: checkCounts[0]?.prs ?? 0,
      conflictsCaught: checkCounts[0]?.conflicts ?? 0,
    },
    limits: PLAN_LIMITS[plan],
  };
}

/** Change an org's plan (no payment processing — a manual plan switch). */
export async function setOrgPlan(orgId: string, plan: OrgPlan): Promise<void> {
  const db = getDb();
  await db.update(organizations).set({ plan }).where(eq(organizations.id, orgId));
}

// ── super-admin console (internal; the /app/admin page) ──

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  createdAt: string;
  repos: number;
  members: Array<{ login: string; email: string | null; role: string }>;
}

/** Every org with its members — powers the internal admin console. */
export async function adminListOrgs(): Promise<AdminOrg[]> {
  const db = getDb();
  const [orgRows, memberRows, repoRows] = await Promise.all([
    db.select().from(organizations).orderBy(desc(organizations.createdAt)),
    db
      .select({
        orgId: memberships.orgId,
        role: memberships.role,
        login: users.login,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId)),
    db
      .select({ orgId: installations.orgId, n: sql<number>`count(*)::int` })
      .from(repos)
      .innerJoin(installations, eq(repos.installationId, installations.id))
      .groupBy(installations.orgId),
  ]);
  const repoCount = new Map(repoRows.map((r) => [r.orgId, r.n]));
  return orgRows.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan as OrgPlan,
    createdAt: o.createdAt.toISOString(),
    repos: repoCount.get(o.id) ?? 0,
    members: memberRows
      .filter((m) => m.orgId === o.id)
      .map(({ login, email, role }) => ({ login, email, role })),
  }));
}

// ── Stripe linkage (plan changes themselves flow through the webhook) ──

export async function getOrgStripe(
  orgId: string,
): Promise<{ plan: OrgPlan; stripeCustomerId: string | null; stripeSubscriptionId: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      plan: organizations.plan,
      stripeCustomerId: organizations.stripeCustomerId,
      stripeSubscriptionId: organizations.stripeSubscriptionId,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row ? { ...row, plan: row.plan as OrgPlan } : null;
}

export async function setOrgStripe(
  orgId: string,
  patch: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null },
): Promise<void> {
  const db = getDb();
  await db.update(organizations).set(patch).where(eq(organizations.id, orgId));
}

export async function findOrgByStripeCustomer(customerId: string): Promise<{ id: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);
  return row ?? null;
}

// ── Agent-run metering (per org, calendar month) ──

/** -1 = unlimited. A business rail, not a technical constant. */
export const AGENT_RUNS_PER_MONTH: Record<OrgPlan, number> = {
  free: 20,
  pro: 500,
  enterprise: -1,
};

export async function countAgentRunsThisMonth(orgId: string): Promise<number> {
  const db = getDb();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentRuns)
    .innerJoin(repos, eq(agentRuns.repoId, repos.id))
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(and(eq(installations.orgId, orgId), sql`${agentRuns.createdAt} >= ${monthStart}`));
  return row?.n ?? 0;
}

export interface ApiProfile {
  login: string;
  email: string | null;
  avatarUrl: string | null;
  githubId: number;
  memberships: Array<{ orgId: string; orgName: string; orgSlug: string; role: string; joinedAt: string }>;
}

/** A user's profile + every org they belong to (for the Profile page). */
export async function getUserProfile(userId: string): Promise<ApiProfile | null> {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const rows = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt);
  return {
    login: u.login,
    email: u.email,
    avatarUrl: u.avatarUrl,
    githubId: u.githubId,
    memberships: rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() })),
  };
}

/** The organization that owns a repo (via its installation). */
export async function getOrgForRepo(repoId: string): Promise<ApiOrg | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .innerJoin(organizations, eq(installations.orgId, organizations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  return row ?? null;
}

/** Org members with their RBAC role, oldest first. */
export async function listOrgMembers(orgId: string, scope?: RepoScope): Promise<ApiMember[]> {
  await requireOrgScope(orgId, scope);
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      login: users.login,
      avatarUrl: users.avatarUrl,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, orgId))
    .orderBy(memberships.createdAt);
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

/** Recent audit-log entries for an org (most recent first). */
export async function listAuditLog(orgId: string, limit = 50, scope?: RepoScope): Promise<ApiAuditEntry[]> {
  await requireOrgScope(orgId, scope);
  const db = getDb();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorUser: r.actorUser,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPRCheck(
  repoId: string,
  prNumber: number,
  scope?: RepoScope,
): Promise<(ApiCheckedPR & { decision?: ApiDecision }) | null> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const [c] = await db
    .select()
    .from(prChecks)
    .where(and(eq(prChecks.repoId, repoId), eq(prChecks.prNumber, prNumber)))
    .orderBy(desc(prChecks.checkedAt))
    .limit(1);
  if (!c) return null;
  let decision: ApiDecision | undefined;
  let matchedText: string | null = null;
  let citation: string | undefined;
  if (c.matchedDecisionId) {
    const [d] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, c.matchedDecisionId), eq(decisions.repoId, repoId)))
      .limit(1);
    if (d) {
      decision = toApiDecision(d);
      matchedText = d.decision;
      citation = d.evidence?.[0];
    }
  }
  return { ...toApiCheck(c, matchedText), citation, decision };
}

/** Structured repo knowledge (architecture + dependency graph) for the Architecture view. */
export async function getRepoKnowledge(repoId: string, scope?: RepoScope) {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const rows = await db
    .select()
    .from(repoKnowledge)
    .where(eq(repoKnowledge.repoId, repoId));
  const byKind = (k: string) => rows.find((r) => r.kind === k)?.data ?? null;
  return {
    architecture: byKind("architecture"),
    dependencyGraph: byKind("dependency_graph"),
    generatedAt: rows[0]?.generatedAt?.toISOString() ?? null,
  };
}

export async function getSettings(repoId: string, scope?: RepoScope) {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const [row] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.repoId, repoId))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(repoSettings)
    .values({ repoId })
    .onConflictDoNothing({ target: repoSettings.repoId })
    .returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.repoId, repoId))
    .limit(1);
  return existing!;
}

export async function updateSettings(
  repoId: string,
  patch: Partial<{
    confidenceThreshold: "low" | "high" | "strict";
    triggerOpened: boolean;
    triggerSynchronize: boolean;
    mode: "comment" | "status_check";
    learnFromDismissals: boolean;
  }>,
  scope?: RepoScope,
) {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  await getSettings(repoId, scope); // ensure row exists
  const [row] = await db
    .update(repoSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(repoSettings.repoId, repoId))
    .returning();
  return row!;
}

/** Enqueue a memory rebuild for a repo. Returns the job id. */
export async function enqueueRebuild(repoId: string, scope?: RepoScope): Promise<{ jobId: string | null }> {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  const [r] = await db
    .select({ fullName: repos.fullName, instGh: installations.githubInstallationId })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  if (!r) throw new Error("repo not found");
  // Dedup floods: one pending/cooldown rebuild per repo so a loop cannot
  // saturate the shared extract queue ahead of other tenants.
  const jobId = await enqueue(
    JOBS.extract,
    {
      installationId: r.instGh,
      fullName: r.fullName,
    },
    { singletonKey: `extract:${repoId}`, singletonHours: 1 },
  );
  return { jobId };
}

export async function dashboardFeedback(
  repoId: string,
  input: { prNumber?: number; decisionId?: string; action: "dismiss" | "confirm"; byUser?: string; reason?: string },
  scope?: RepoScope,
) {
  await requireRepoScope(repoId, scope);
  const db = getDb();
  let prCheckId: string | null = null;
  if (input.prNumber != null) {
    const [check] = await db
      .select({ id: prChecks.id })
      .from(prChecks)
      .where(and(eq(prChecks.repoId, repoId), eq(prChecks.prNumber, input.prNumber)))
      .orderBy(desc(prChecks.checkedAt))
      .limit(1);
    prCheckId = check?.id ?? null;
  }
  if (input.decisionId) {
    const [own] = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(and(eq(decisions.id, input.decisionId), eq(decisions.repoId, repoId)))
      .limit(1);
    if (!own) throw new Error("decision not in repo");
  }
  const [row] = await db
    .insert(feedbackTable)
    .values({
      repoId,
      prCheckId,
      decisionId: input.decisionId ?? null,
      action: input.action,
      byUser: input.byUser ?? null,
      reason: input.reason ?? null,
    })
    .returning();
  // A human confirmation reinforces the memory (confirmed + freshness + confidence).
  if (input.action === "confirm" && input.decisionId) {
    await reinforce(repoId, input.decisionId, "confirmed");
  }
  return row;
}
