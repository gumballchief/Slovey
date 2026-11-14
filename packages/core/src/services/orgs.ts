import { getDb, installations, memberships, organizations, users } from "@company-brain/db";
import { and, eq, isNull, notInArray } from "drizzle-orm";

export type Role = "owner" | "admin" | "member" | "viewer";

/**
 * Create/find the organization for an installation's GitHub account.
 *
 * The org is identified by the account's immutable GitHub id, never by its
 * login: a login can be renamed and then registered by someone else, and
 * matching on it would hand the new owner the old org (its members, plan and
 * decisions). The slug is the login, kept for display only.
 *
 * Orgs created before github_account_id existed have it null. One of those is
 * adopted only when this installation already points at it (an installation
 * never changes account, so that covers renames), or when `ownsLegacyOrg`
 * confirms the account really is the one the org was made for. Otherwise this
 * account gets a new org and the old one is left alone.
 */
export async function ensureOrg(
  account: { id: number | null; login: string },
  opts: { linkedOrgId: string | null; ownsLegacyOrg: (orgId: string) => Promise<boolean> },
): Promise<string> {
  const db = getDb();
  const login = account.login;
  const slug = login.toLowerCase();

  if (account.id == null) {
    // GitHub always sends the account id; without it there is no safe identity,
    // so never attach to an existing org.
    throw new Error("ensureOrg: GitHub account id missing");
  }
  const accountId = account.id;

  // 1. Already linked by id. The login may have changed, so refresh the name
  // and, when nobody else holds it, the slug.
  const [byId] = await db
    .select({ id: organizations.id, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.githubAccountId, accountId))
    .limit(1);
  if (byId) {
    await db.update(organizations).set({ name: login }).where(eq(organizations.id, byId.id));
    if (byId.slug !== slug) await trySetSlug(byId.id, slug);
    return byId.id;
  }

  // 2. The legacy org this same installation already belongs to.
  if (opts.linkedOrgId) {
    const claimed = await claimLegacyOrg(opts.linkedOrgId, accountId, login);
    if (claimed) {
      await trySetSlug(claimed, slug);
      return claimed;
    }
  }

  // 3. A legacy org holding this login's slug, if the account proves it's theirs.
  const [bySlug] = await db
    .select({ id: organizations.id, githubAccountId: organizations.githubAccountId })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (bySlug && bySlug.githubAccountId == null && (await opts.ownsLegacyOrg(bySlug.id))) {
    const claimed = await claimLegacyOrg(bySlug.id, accountId, login);
    if (claimed) return claimed;
    // Lost a race to a concurrent sync of the same account: fall through and
    // pick up the row it linked.
  }

  // 4. A new account, or a reused login whose old org belongs to someone else:
  // a fresh org. The slug is taken in that second case, so add the id.
  const [org] = await db
    .insert(organizations)
    .values({ name: login, slug: bySlug ? `${slug}-${accountId}` : slug, githubAccountId: accountId })
    .onConflictDoUpdate({ target: organizations.githubAccountId, set: { name: login } })
    .returning({ id: organizations.id });
  if (!org) throw new Error("ensureOrg: failed to upsert organization");
  return org.id;
}

/** Link a legacy org (no account id yet) to this account. Null if it already has one. */
async function claimLegacyOrg(orgId: string, accountId: number, login: string): Promise<string | null> {
  const db = getDb();
  const [claimed] = await db
    .update(organizations)
    .set({ githubAccountId: accountId, name: login })
    .where(and(eq(organizations.id, orgId), isNull(organizations.githubAccountId)))
    .returning({ id: organizations.id });
  return claimed?.id ?? null;
}

/** Point an org's slug at its account's current login, unless another org has it. */
async function trySetSlug(orgId: string, slug: string): Promise<void> {
  const db = getDb();
  const [taken] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (taken) return;
  try {
    await db.update(organizations).set({ slug }).where(eq(organizations.id, orgId));
  } catch {
    // Another org took the slug in between. It is display only; keep the old one.
  }
}

/**
 * Link a user to an org as owner, idempotently. Used when the user→org link is
 * already known from a trusted source — principally a personal-account App
 * installation, where the account owner is unambiguously the org owner — so we
 * do not have to wait for the user's next GitHub sign-in to create the row.
 *
 * onConflictDoNothing: an existing membership (any role) is left untouched. The
 * bug this addresses is a MISSING row, never a wrong one, so a webhook must not
 * silently rewrite a role someone already has.
 */
export async function ensureOwnerMembership(orgId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(memberships)
    .values({ orgId, userId, role: "owner" })
    .onConflictDoNothing({ target: [memberships.orgId, memberships.userId] });
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

/** The GitHub numeric id for one of our users, or null. The reverse of
 * getUserIdByGithubId — used to authorize a token holder as a repo owner. */
export async function getUserGithubId(userId: string): Promise<number | null> {
  const db = getDb();
  const [u] = await db
    .select({ githubId: users.githubId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.githubId ?? null;
}

/**
 * The caller's verified GitHub id + login. Users rows are only written from the
 * verified GitHub identity at sign-in, so the login is a real GitHub handle
 * (never an email-derived one).
 */
export async function getUserGithubIdentity(userId: string): Promise<{ githubId: number; login: string } | null> {
  const db = getDb();
  const [u] = await db
    .select({ githubId: users.githubId, login: users.login })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

/**
 * Repo-owner check for API-token callers, mirroring resolveAccess in the web
 * layer: match the immutable owner id when the row has it; rows synced before
 * owner_github_id existed fall back to a login match for a GitHub identity.
 */
export function isRepoOwnerByIdentity(
  repo: { owner: string; ownerGithubId: number | null },
  caller: { githubId: number; login: string } | null,
): boolean {
  if (!caller) return false;
  if (repo.ownerGithubId != null) return repo.ownerGithubId === caller.githubId;
  return repo.owner.toLowerCase() === caller.login.toLowerCase();
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
    let url: string | null = "https://api.github.com/user/installations?per_page=100";
    while (url) {
      const res: Response = await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "company-brain",
          "x-github-api-version": "2022-11-28",
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { installations?: Array<{ id: number }> };
      accessible.push(...(data.installations ?? []));
      const link: string | null = res.headers.get("link");
      url = null;
      if (link) {
        for (const part of link.split(",") as string[]) {
          const m: RegExpMatchArray | null = part.match(/<([^>]+)>\s*;\s*rel="next"/);
          if (m && m[1]) {
            url = m[1];
            break;
          }
        }
      }
    }
  } catch {
    return;
  }

  const accessibleOrgIds: string[] = [];
  for (const inst of accessible) {
    const [row] = await db
      .select({
        orgId: installations.orgId,
        accountLogin: installations.accountLogin,
        orgGithubId: organizations.githubAccountId,
      })
      .from(installations)
      .leftJoin(organizations, eq(installations.orgId, organizations.id))
      .where(eq(installations.githubInstallationId, inst.id))
      .limit(1);
    if (!row?.orgId) continue;
    accessibleOrgIds.push(row.orgId);
    // Owner = the account the org mirrors, matched by immutable id. Orgs not
    // yet linked to an id fall back to the login match they always used.
    const isAccountOwner =
      row.orgGithubId != null
        ? row.orgGithubId === githubId
        : row.accountLogin?.toLowerCase() === login.toLowerCase();
    const role: Role = isAccountOwner ? "owner" : "member";
    await db
      .insert(memberships)
      .values({ orgId: row.orgId, userId, role })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        set: { role },
      });
  }

  // Prune memberships for orgs the user can no longer access on GitHub, so being
  // removed from an org actually revokes their access here (and their CLI tokens
  // stop working) on their next sign-in — rather than lingering forever. Only
  // runs after a successful installations fetch (early-returns above on failure),
  // so a transient GitHub error never wrongly wipes memberships.
  await db
    .delete(memberships)
    .where(
      accessibleOrgIds.length
        ? and(eq(memberships.userId, userId), notInArray(memberships.orgId, accessibleOrgIds))
        : eq(memberships.userId, userId),
    );
}
