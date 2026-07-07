import { getDb, decisions, installations, organizations, repos } from "@company-brain/db";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { PLAN_LIMITS, type OrgPlan } from "./dashboard";

/**
 * Plan-limit enforcement. PLAN_LIMITS was previously display-only; these
 * checks make it real at the points where value is delivered (PR checks,
 * memory building) and where data is created (decisions, imports).
 *
 * Fail-open by design: a repo with no org (or a lookup error) is never
 * blocked — billing enforcement must not take the product down.
 */

export interface RepoPlanGate {
  ok: boolean;
  plan: OrgPlan;
  /** -1 = unlimited. */
  limit: number;
}

interface RepoOrgPlan {
  orgId: string;
  plan: OrgPlan;
  createdAt: Date;
  repoId: string;
}

async function repoOrgPlan(repoId: string): Promise<RepoOrgPlan | null> {
  const db = getDb();
  const [row] = await db
    .select({
      orgId: organizations.id,
      plan: organizations.plan,
      createdAt: repos.createdAt,
      repoId: repos.id,
    })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .innerJoin(organizations, eq(installations.orgId, organizations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  return row ? { ...row, plan: row.plan as OrgPlan } : null;
}

/**
 * Is this repo within its org's repo allowance? The first N repos by
 * createdAt (id as tiebreak) stay active; later ones are outside the plan.
 * Deterministic, so the same repos stay active across calls.
 */
export async function isRepoWithinPlan(repoId: string): Promise<RepoPlanGate> {
  const info = await repoOrgPlan(repoId).catch(() => null);
  if (!info) return { ok: true, plan: "free", limit: -1 };
  const limit = PLAN_LIMITS[info.plan].repos;
  if (limit < 0) return { ok: true, plan: info.plan, limit };

  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(
      and(
        eq(installations.orgId, info.orgId),
        or(
          lt(repos.createdAt, info.createdAt),
          and(eq(repos.createdAt, info.createdAt), lt(repos.id, info.repoId)),
        ),
      ),
    );
  const rank = row?.n ?? 0; // repos ahead of this one
  return { ok: rank < limit, plan: info.plan, limit };
}

export interface DecisionHeadroom {
  ok: boolean;
  used: number;
  /** -1 = unlimited. */
  limit: number;
  plan: OrgPlan;
}

/** Does the org owning this repo have room for `adding` more decisions? */
export async function decisionHeadroom(repoId: string, adding = 1): Promise<DecisionHeadroom> {
  const info = await repoOrgPlan(repoId).catch(() => null);
  if (!info) return { ok: true, used: 0, limit: -1, plan: "free" };
  const limit = PLAN_LIMITS[info.plan].decisions;
  if (limit < 0) return { ok: true, used: 0, limit, plan: info.plan };

  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(decisions)
    .innerJoin(repos, eq(decisions.repoId, repos.id))
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(and(eq(installations.orgId, info.orgId), ne(decisions.status, "removed")));
  const used = row?.n ?? 0;
  return { ok: used + adding <= limit, used, limit, plan: info.plan };
}
