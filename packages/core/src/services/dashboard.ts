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
import { getEmbeddings } from "../embeddings";
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
function toApiDecision(d: typeof decisions.$inferSelect): ApiDecision {
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

export async function listRepos(): Promise<ApiRepo[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: repos.id,
      fullName: repos.fullName,
      owner: repos.owner,
      accountLogin: installations.accountLogin,
    })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id));

  const out: ApiRepo[] = [];
  for (const r of rows) {
    const stats = await repoStats(r.id);
    out.push({
      id: r.id,
      name: r.fullName,
      org: r.accountLogin ?? r.owner,
      ...stats,
      trend: await repoTrend(r.id),
    });
  }
  return out;
}

export async function getOverview(repoId: string) {
  const db = getDb();
  const stats = await repoStats(repoId);
  const trend = await repoTrend(repoId);
  const recentRows = await db
    .select()
    .from(prChecks)
    .where(eq(prChecks.repoId, repoId))
    .orderBy(desc(prChecks.checkedAt))
    .limit(8);

  // Resolve all matched-decision texts in one query (was one query per row).
  const matchedIds = [...new Set(recentRows.map((c) => c.matchedDecisionId).filter((x): x is string => Boolean(x)))];
  const textById = new Map<string, string>();
  if (matchedIds.length > 0) {
    const ds = await db
      .select({ id: decisions.id, decision: decisions.decision })
      .from(decisions)
      .where(inArray(decisions.id, matchedIds));
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
): Promise<ApiDecision[]> {
  const db = getDb();
  const conds = [eq(decisions.repoId, repoId), sql`${decisions.status} <> 'removed'`];
  if (filter.source) conds.push(eq(decisions.source, filter.source as ApiDecision["source"]));
  if (filter.query) {
    const q = `%${filter.query}%`;
    conds.push(or(ilike(decisions.decision, q), ilike(decisions.why, q))!);
  }
  const rows = await db
    .select()
    .from(decisions)
    .where(and(...conds))
    .orderBy(desc(decisions.createdAt));
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
): Promise<ApiDecision[]> {
  const q = query.trim();
  if (!q) return listDecisions(repoId);
  const vec = await getEmbeddings().embedOne(q);
  const lit = `[${vec.join(",")}]`;
  const db = getDb();
  const rows = await db
    .select()
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, repoId),
        sql`${decisions.status} <> 'removed'`,
        sql`${decisions.embedding} is not null`,
      ),
    )
    .orderBy(sql`${decisions.embedding} <=> ${lit}::vector`)
    .limit(limit);
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
): Promise<ApiDecision> {
  const db = getDb();
  const text = [input.decision, input.why ?? "", (input.examples ?? []).join(" ")].join("\n");
  const embedding = await getEmbeddings().embedOne(text);
  const [row] = await db
    .insert(decisions)
    .values({
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
    })
    .returning();
  return toApiDecision(row!);
}

export async function updateDecision(
  repoId: string,
  id: string,
  patch: { decision?: string; why?: string; examples?: string[]; evidence?: string[]; status?: "approved" | "suggested" | "removed" },
): Promise<ApiDecision | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .limit(1);
  if (!current) return null;

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
    set.embedding = await getEmbeddings().embedOne(text);
  }
  const [row] = await db
    .update(decisions)
    .set(set)
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning();
  return row ? toApiDecision(row) : null;
}

/** Soft-delete (status='removed') so retrieval excludes it but history is kept. */
export async function removeDecision(repoId: string, id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(decisions)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(decisions.id, id), eq(decisions.repoId, repoId)))
    .returning({ id: decisions.id });
  return rows.length > 0;
}

export async function listPRChecks(repoId: string): Promise<ApiCheckedPR[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(prChecks)
    .where(eq(prChecks.repoId, repoId))
    .orderBy(desc(prChecks.checkedAt));
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
  pro: { repos: 10, decisions: 5000 },
  enterprise: { repos: -1, decisions: -1 },
};

/** Plan + real current usage for an org (drives the Billing page). */
export async function getBilling(orgId: string): Promise<ApiBilling> {
  const db = getDb();
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const plan = (org?.plan ?? "free") as OrgPlan;

  const repoRows = await db
    .select({ id: repos.id })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(installations.orgId, orgId));
  const repoIds = repoRows.map((r) => r.id);

  const [members] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(eq(memberships.orgId, orgId));

  let decisionsN = 0;
  let prsN = 0;
  let conflictsN = 0;
  if (repoIds.length > 0) {
    const [d] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(decisions)
      .where(and(inArray(decisions.repoId, repoIds), ne(decisions.status, "removed")));
    const [p] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(prChecks)
      .where(inArray(prChecks.repoId, repoIds));
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(prChecks)
      .where(and(inArray(prChecks.repoId, repoIds), eq(prChecks.verdict, "conflict")));
    decisionsN = d?.n ?? 0;
    prsN = p?.n ?? 0;
    conflictsN = c?.n ?? 0;
  }

  return {
    plan,
    usage: {
      repos: repoIds.length,
      members: members?.n ?? 0,
      decisions: decisionsN,
      prsChecked: prsN,
      conflictsCaught: conflictsN,
    },
    limits: PLAN_LIMITS[plan],
  };
}

/** Change an org's plan (no payment processing — a manual plan switch). */
export async function setOrgPlan(orgId: string, plan: OrgPlan): Promise<void> {
  const db = getDb();
  await db.update(organizations).set({ plan }).where(eq(organizations.id, orgId));
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
export async function listOrgMembers(orgId: string): Promise<ApiMember[]> {
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
export async function listAuditLog(orgId: string, limit = 50): Promise<ApiAuditEntry[]> {
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
): Promise<(ApiCheckedPR & { decision?: ApiDecision }) | null> {
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
      .where(eq(decisions.id, c.matchedDecisionId))
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
export async function getRepoKnowledge(repoId: string) {
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

export async function getSettings(repoId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.repoId, repoId))
    .limit(1);
  if (row) return row;
  const [created] = await db.insert(repoSettings).values({ repoId }).returning();
  return created!;
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
) {
  const db = getDb();
  await getSettings(repoId); // ensure row exists
  const [row] = await db
    .update(repoSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(repoSettings.repoId, repoId))
    .returning();
  return row!;
}

/** Enqueue a memory rebuild for a repo. Returns the job id. */
export async function enqueueRebuild(repoId: string): Promise<{ jobId: string | null }> {
  const db = getDb();
  const [r] = await db
    .select({ fullName: repos.fullName, instGh: installations.githubInstallationId })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  if (!r) throw new Error("repo not found");
  const jobId = await enqueue(JOBS.extract, {
    installationId: r.instGh,
    fullName: r.fullName,
  });
  return { jobId };
}

export async function dashboardFeedback(
  repoId: string,
  input: { prNumber?: number; decisionId?: string; action: "dismiss" | "confirm"; byUser?: string; reason?: string },
) {
  const db = getDb();
  const [row] = await db
    .insert(feedbackTable)
    .values({
      repoId,
      prCheckId: null,
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
