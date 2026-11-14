import {
  dashboard,
  getUserGithubIdentity,
  isRepoOwnerByIdentity,
  resolveRepoById,
  verifyApiToken,
} from "@company-brain/core";
import { HttpError } from "./respond";

export interface CliCaller {
  repoId: string;
  repoFullName: string;
  userId: string;
}

/** The `cb_…` token from an `Authorization: Bearer` header, or null. */
export function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() || null : null;
}

/**
 * Authorize a repo-scoped API token (the key the CLI, the MCP server and agents
 * use). The token names its repository, so a caller can never reach another
 * organization's decisions by asking differently.
 *
 * Owner-first, mirroring how tokens are minted (resolveAccess in auth.ts): a
 * personal-account owner is authorized by GitHub id even with no membership row.
 * Everyone else must still belong to the repository's organization, which is
 * refreshed at each GitHub sign-in, so removing someone on GitHub revokes them here.
 */
export async function authorizeCliToken(req: Request): Promise<CliCaller> {
  const verified = await verifyApiToken(bearerToken(req));
  if (!verified) {
    throw new HttpError(401, "Invalid or missing API key. Create one in Slovey under Connect, then send it as a Bearer token.");
  }

  const repo = await resolveRepoById(verified.repoId);
  if (!repo) throw new HttpError(404, "The repository this key was issued for no longer exists.");

  const caller = await getUserGithubIdentity(verified.userId);
  if (!isRepoOwnerByIdentity(repo, caller)) {
    if (!repo.orgId) throw new HttpError(403, "Your access to this repository has been revoked.");
    const orgIds = await dashboard.listUserOrgIds(verified.userId);
    if (!orgIds.includes(repo.orgId)) throw new HttpError(403, "Your access to this repository has been revoked.");
  }

  return { repoId: verified.repoId, repoFullName: repo.fullName, userId: verified.userId };
}
