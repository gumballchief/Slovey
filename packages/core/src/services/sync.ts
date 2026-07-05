import { getDb, installations, repos, repoSettings } from "@company-brain/db";
import { eq, isNull } from "drizzle-orm";
import { getApp, getInstallationOctokit } from "../github/app";
import { logAudit } from "./audit";
import { ensureOrg } from "./orgs";

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
    | { login?: string; slug?: string; type?: string }
    | null;
  const accountLogin = account?.login ?? account?.slug ?? "unknown";
  const accountType = (account?.type === "User" ? "User" : "Organization") as
    | "User"
    | "Organization";

  // Every installation belongs to an organization (the account it's installed on).
  const orgId = await ensureOrg(accountLogin);

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
  const list = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });

  for (const r of list.data.repositories) {
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
        target: repos.fullName,
        set: {
          installationId: inst.id,
          owner: r.owner.login,
          ownerGithubId: r.owner.id,
          defaultBranch: r.default_branch ?? "main",
          isPrivate: r.private,
        },
      })
      .returning();
    if (repoRow) {
      await db.insert(repoSettings).values({ repoId: repoRow.id }).onConflictDoNothing();
    }
  }
  await logAudit({ orgId, action: "installation.synced", actorUser: "system", metadata: { installationId, repos: list.data.repositories.length } });
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

/** Resolve a repo by id (used by the web layer's repo-access check). */
export async function resolveRepoById(repoId: string): Promise<ResolvedRepo | null> {
  const db = getDb();
  const [row] = await db
    .select(RESOLVE_COLUMNS)
    .from(repos)
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .where(eq(repos.id, repoId))
    .limit(1);
  return row ?? null;
}
