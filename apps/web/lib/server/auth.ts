import {
  getUserIdByGithubId,
  resolveRepoById,
  userOrgRole,
  type ResolvedRepo,
  type Role,
} from "@company-brain/core";
import { auth } from "@/auth";
import { HttpError } from "./respond";

export interface Viewer {
  login: string;
  githubId?: number;
  userId?: string;
  isDev: boolean;
}

function oauthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.NEXTAUTH_SECRET,
  );
}

/**
 * Resolve the current viewer from the Auth.js session (incl. their DB user id,
 * needed for membership checks). Dev mode returns a dev viewer when OAuth isn't
 * configured so the dashboard is usable locally.
 */
export async function getViewer(): Promise<Viewer | null> {
  if (oauthConfigured()) {
    const session = await auth();
    const u = session?.user as { login?: string; githubId?: number } | undefined;
    if (u?.login) {
      const userId = u.githubId ? ((await getUserIdByGithubId(u.githubId)) ?? undefined) : undefined;
      return { login: u.login, githubId: u.githubId, userId, isDev: false };
    }
    if (process.env.NODE_ENV === "production") return null;
  }
  if (process.env.NODE_ENV !== "production") {
    return { login: "dev", isDev: true };
  }
  return null;
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, "Unauthorized");
  return viewer;
}

/**
 * Resolve a repo + the viewer's effective role on it. Enforces tenancy:
 *  - dev viewer → owner (local only)
 *  - account owner (login matches repo owner) → owner
 *  - org member → their membership role
 *  - otherwise → 403 (a user can never touch another org's repo)
 */
async function resolveAccess(
  repoId: string,
  viewer: Viewer,
): Promise<{ repo: ResolvedRepo; role: Role }> {
  const repo = await resolveRepoById(repoId);
  if (!repo) throw new HttpError(404, "Repo not found");

  if (viewer.isDev) return { repo, role: "owner" };
  if (repo.owner.toLowerCase() === viewer.login.toLowerCase()) return { repo, role: "owner" };
  if (viewer.userId && repo.orgId) {
    const role = await userOrgRole(viewer.userId, repo.orgId);
    if (role) return { repo, role };
  }
  throw new HttpError(403, "Forbidden");
}

/** Read access — any member, owner, or dev. */
export async function assertRepoAccess(repoId: string, viewer: Viewer): Promise<ResolvedRepo> {
  return (await resolveAccess(repoId, viewer)).repo;
}

/** Read access that also returns the viewer's effective role (for the org page). */
export async function assertRepoAccessWithRole(
  repoId: string,
  viewer: Viewer,
): Promise<{ repo: ResolvedRepo; role: Role }> {
  return resolveAccess(repoId, viewer);
}

/** Write access — blocks the read-only `viewer` role. */
export async function assertRepoWrite(repoId: string, viewer: Viewer): Promise<ResolvedRepo> {
  const { repo, role } = await resolveAccess(repoId, viewer);
  if (role === "viewer") throw new HttpError(403, "Your role is read-only");
  return repo;
}
