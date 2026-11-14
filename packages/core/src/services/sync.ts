import { getDb, installations, repos, repoSettings } from "@company-brain/db";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getApp, getInstallationOctokit } from "../github/app";
import { logAudit } from "./audit";
import { ensureOrg, ensureOwnerMembership, getUserIdByGithubId, userOrgRole } from "./orgs";

/**
 * Whether a GitHub account really is the one an org made before
 * github_account_id existed was created for. Such an org only has a login
 * (its slug), and a login can be re-registered by someone else after a rename.
 */
async function accountOwnsLegacyOrg(
  orgId: string,
  installationId: number,
  account: { id: number; type: "User" | "Organization" },
): Promise<boolean> {
  const db = getDb();
  const linked = await db
    .select({ githubInstallationId: installations.githubInstallationId })
    .from(installations)
    .where(eq(installations.orgId, orgId));
  // Set up by hand before any install (e.g. a plan granted in advance): there
  // is nothing in it to take over, so the login is enough, as before.
  if (linked.length === 0) return true;
  // The same installation syncing again. An installation never changes account.
  if (linked.some((l) => l.githubInstallationId === installationId)) return true;

  // Ask GitHub who owns the org's other installations.
  const app = getApp();
  for (const l of linked) {
    try {
      const res = await app.octokit.request("GET /app/installations/{installation_id}", {
        installation_id: l.githubInstallationId,
      });
      const ownerId = (res.data.account as { id?: number } | null)?.id;
      if (typeof ownerId === "number") return ownerId === account.id;
    } catch {
      // Uninstalled since: this one can't tell us anything.
    }
  }
  // Every earlier installation is gone. A personal account can still prove it:
  // its own user is already this org's owner here.
  if (account.type === "User") {
    const userId = await getUserIdByGithubId(account.id);
    if (userId && (await userOrgRole(userId, orgId)) === "owner") return true;
  }
  return false;
}

/**
 * Upsert an installation and all repos it can access, with default settings.
 * Runs on install and on `installation_repositories` changes.
 */
export async function syncInstallation(installationId: number) {
  const db = getDb();
  const app = getApp();

  const meta = await app.octokit.request("GET /app/installations/{installation_id}", {
    installation_id: installationId,
  });
  const account = meta.data.account as
    | { id?: number; login?: string; slug?: string; type?: string }
    | null;
  const accountLogin = account?.login ?? account?.slug ?? "unknown";
  const accountType = (account?.type === "User" ? "User" : "Organization") as
    | "User"
    | "Organization";

  // Every installation belongs to an organization (the account it's installed
  // on), identified by the account's immutable GitHub id.
  const accountId = typeof account?.id === "number" ? account.id : null;
  const [existing] = await db
    .select({ orgId: installations.orgId })
    .from(installations)
    .where(eq(installations.githubInstallationId, installationId))
    .limit(1);
  const orgId = await ensureOrg(
    { id: accountId, login: accountLogin },
    {
      linkedOrgId: existing?.orgId ?? null,
      ownsLegacyOrg: (legacyOrgId) =>
        accountId == null
          ? Promise.resolve(false)
          : accountOwnsLegacyOrg(legacyOrgId, installationId, { id: accountId, type: accountType }),
    },
  );

  // A personal-account installation has exactly one member — the account owner —
  // so link them as owner now, rather than waiting for their next GitHub sign-in
  // to sync it. Without this, someone who installs the App and then signs in with
  // Google (or installs it after already signing in) has no membership row and
  // gets a 403 on their own repositories' API — the exact first-run path the
  // launch sends people down. Organization installs stay login-driven: their
  // members come from GitHub org membership, synced in linkUserMemberships.
  if (accountType === "User" && account?.id) {
    const ownerUserId = await getUserIdByGithubId(account.id);
    if (ownerUserId) await ensureOwnerMembership(orgId, ownerUserId);
  }

  const [inst] = await db
    .insert(installations)
    .values({ githubInstallationId: installationId, accountLogin, accountType, orgId })
    .onConflictDoUpdate({
      target: installations.githubInstallationId,
      set: { accountLogin, accountType, orgId, suspendedAt: null },
    })
    .returning();
  if (!inst) throw new Error("Failed to upsert installation");

  const octokit = await getInstallationOctokit(installationId);
  const allRepos: Array<Awaited<ReturnType<typeof octokit.rest.apps.listReposAccessibleToInstallation>>["data"]["repositories"][number]> = [];
  for (let page = 1; ; page++) {
    const list = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100, page });
    allRepos.push(...list.data.repositories);
    if (list.data.repositories.length < 100) break;
  }

  for (const r of allRepos) {
    // A repo is identified by GitHub's repo id, which survives renames and
    // transfers. A different row still holding this full name is stale (GitHub
    // never gives two repos one name at once: that repo was renamed, moved or
    // deleted), so move it aside rather than overwrite it. Another repo must
    // never inherit its decisions; if it still exists, its own next sync gives
    // it its current name.
    await db
      .update(repos)
      .set({ fullName: sql`${repos.fullName} || ' (moved ' || ${repos.githubRepoId}::text || ')'` })
      .where(and(eq(repos.fullName, r.full_name), ne(repos.githubRepoId, r.id)));
    const [repoRow] = await db
      .insert(repos)
      .values({
        installationId: inst.id,
        githubRepoId: r.id,
        owner: r.owner.login,
        ownerGithubId: r.owner.id,
        name: r.name,
        fullName: r.full_name,
        defaultBranch: r.default_branch ?? "main",
        isPrivate: r.private,
      })
      .onConflictDoUpdate({
        target: repos.githubRepoId,
        set: {
          installationId: inst.id,
          owner: r.owner.login,
          ownerGithubId: r.owner.id,
          name: r.name,
          fullName: r.full_name,
          defaultBranch: r.default_branch ?? "main",
          isPrivate: r.private,
        },
      })
      .returning();
    if (repoRow) {
      await db.insert(repoSettings).values({ repoId: repoRow.id }).onConflictDoNothing();
    }
  }
  // Repos this installation no longer sees are deliberately NOT deleted here:
  // deleting a repo cascades to its learned decisions, and a single empty or
  // partial GitHub response must never wipe a customer's memory.
  await logAudit({ orgId, action: "installation.synced", actorUser: "system", metadata: { installationId, repos: allRepos.length } });
  return inst;
}

export interface ResolvedRepo {
  repoId: string;
  owner: string;
  ownerGithubId: number | null;
  name: string;
  fullName: string;
  defaultBranch: string;
  installationGithubId: number;
  orgId: string | null;
}

const RESOLVE_COLUMNS = {
  repoId: repos.id,
  owner: repos.owner,
  ownerGithubId: repos.ownerGithubId,
  name: repos.name,
  fullName: repos.fullName,
  defaultBranch: repos.defaultBranch,
  installationGithubId: installations.githubInstallationId,
  orgId: installations.orgId,
} as const;

/** Resolve a repo (and its installation's GitHub id + org) by full name. */
export async function resolveRepo(fullName: string): Promise<ResolvedRepo | null> {
  const db = getDb();
  const [row] = await db
    .select(RESOLVE_COLUMNS)
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.fullName, fullName))
    .limit(1);
  return row ?? null;
}

/** All repos across active installations — used by scheduled rescans. */
export async function listAllRepos(): Promise<ResolvedRepo[]> {
  const db = getDb();
  return db
    .select(RESOLVE_COLUMNS)
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(isNull(installations.suspendedAt));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a repo by id (used by the web layer's repo-access check). */
export async function resolveRepoById(repoId: string): Promise<ResolvedRepo | null> {
  // A malformed id is simply "not found": passed to Postgres it raises a uuid
  // parse error, which surfaced as a 500 on every /api/repos/<bad id>/… route.
  if (!UUID_RE.test(repoId)) return null;
  const db = getDb();
  const [row] = await db
    .select(RESOLVE_COLUMNS)
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  return row ?? null;
}
