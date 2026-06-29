import { getDb, installations, memberships, organizations, users } from "@company-brain/db";
import { and, eq } from "drizzle-orm";

export type Role = "owner" | "admin" | "member" | "viewer";

/** Create/find the organization for an installation account (slug = account login). */
export async function ensureOrg(accountLogin: string): Promise<string> {
  const db = getDb();
  const [org] = await db
    .insert(organizations)
    .values({ name: accountLogin, slug: accountLogin.toLowerCase() })
    .onConflictDoUpdate({ target: organizations.slug, set: { name: accountLogin } })
    .returning();
  if (!org) throw new Error("ensureOrg: failed to upsert organization");
  return org.id;
}

export async function getUserIdByGithubId(githubId: number): Promise<string | null> {
  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubId, githubId))
    .limit(1);
  return u?.id ?? null;
}

/** The viewer's role in an org, or null if they're not a member. */
export async function userOrgRole(userId: string, orgId: string): Promise<Role | null> {
  const db = getDb();
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return (m?.role as Role | undefined) ?? null;
}

/**
 * Populate the user's org memberships from GitHub at login. Uses the user's
 * OAuth token to list the installations they can access, mapping each to our
 * org + assigning a role (owner for their own account, member otherwise).
 * Best-effort: a failure here never blocks login.
 */
export async function linkUserMemberships(
  githubId: number,
  login: string,
  accessToken: string,
): Promise<void> {
  const db = getDb();
  const userId = await getUserIdByGithubId(githubId);
  if (!userId) return;

  let accessible: Array<{ id: number }> = [];
  try {
    const res = await fetch("https://api.github.com/user/installations?per_page=100", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "company-brain",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { installations?: Array<{ id: number }> };
    accessible = data.installations ?? [];
  } catch {
    return;
  }

  for (const inst of accessible) {
    const [row] = await db
      .select({ orgId: installations.orgId, accountLogin: installations.accountLogin })
      .from(installations)
      .where(eq(installations.githubInstallationId, inst.id))
      .limit(1);
    if (!row?.orgId) continue;
    const role: Role =
      row.accountLogin?.toLowerCase() === login.toLowerCase() ? "owner" : "member";
    await db
      .insert(memberships)
      .values({ orgId: row.orgId, userId, role })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        set: { role },
      });
  }
}
