import {
  getUserIdByGithubId,
  resolveRepoById,
  upsertUser,
  userOrgRole,
  type ResolvedRepo,
  type Role,
} from "@company-brain/core";
import { createSupabaseServer, supabaseConfigured } from "./supabase";
import { HttpError } from "./respond";

export interface Viewer {
  login: string;
  githubId?: number;
  userId?: string;
  isDev: boolean;
}

/** GitHub identity carried in a Supabase user's metadata (provider = github). */
interface GhMeta {
  user_name?: string;
  preferred_username?: string;
  provider_id?: string | number;
  avatar_url?: string;
}

/**
 * Resolve the current viewer from the Supabase Auth session (incl. their DB user
 * id, needed for membership checks). The GitHub identity lives in user_metadata.
 * First-seen users are upserted lazily so a `users` row always exists. Dev mode
 * returns a dev viewer when Supabase isn't configured so the dashboard is usable
 * locally.
 */
export async function getViewer(): Promise<Viewer | null> {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user) {
      const meta = (user.user_metadata ?? {}) as GhMeta;
      // Prefer the GitHub identity from `identities` so repo access works whether
      // GitHub is the primary login OR was linked onto a Google (etc.) account.
      const identities = (user.identities ?? []) as Array<{ provider: string; identity_data?: GhMeta }>;
      const ghData = (identities.find((i) => i.provider === "github")?.identity_data ?? {}) as GhMeta;
      const login =
        ghData.user_name || ghData.preferred_username || meta.user_name || meta.preferred_username || user.email?.split("@")[0] || "user";
      const githubId = ghData.provider_id
        ? Number(ghData.provider_id)
        : meta.provider_id
          ? Number(meta.provider_id)
          : undefined;
      let userId = githubId ? ((await getUserIdByGithubId(githubId)) ?? undefined) : undefined;
      // Lazily ensure a DB user exists (callback usually does this on first login).
      if (githubId && !userId) {
        const row = await upsertUser({
          githubId,
          login,
          email: user.email ?? null,
          avatarUrl: ghData.avatar_url ?? meta.avatar_url ?? null,
        });
        userId = row?.id;
      }
      return { login, githubId, userId, isDev: false };
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
  // Prefer the immutable GitHub account id — logins can change or be recycled,
  // so a string match alone could hand owner access to whoever claims an
  // abandoned login. Fall back to the login match only for rows synced before
  // owner_github_id existed (backfilled on the next installation sync).
  const isOwner =
    repo.ownerGithubId != null && viewer.githubId != null
      ? repo.ownerGithubId === viewer.githubId
      : repo.owner.toLowerCase() === viewer.login.toLowerCase();
  if (isOwner) return { repo, role: "owner" };
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
