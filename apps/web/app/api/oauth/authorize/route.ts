import { getUserIdByGithubId } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { OAuthError, mintCode, parseAuthorizeRequest, publicOrigin, redirectWith } from "@/lib/server/oauth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Allow / Cancel buttons on the "Sign in with Slovey" page. Re-validates the
 * whole authorization request server-side, checks the viewer can read the chosen
 * repository, and answers with where to send the browser next (back to the app,
 * carrying a one-time code, or an access_denied error).
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    // Same-origin only: the consent decision must come from Slovey's own page.
    const origin = publicOrigin(req);
    if (req.headers.get("origin") !== origin) throw new HttpError(403, "Cross-site request refused.");

    const body = await readJsonBody<{ request?: string; repoId?: string; decision?: string }>(req, 20_000);
    let authz;
    try {
      authz = parseAuthorizeRequest(new URLSearchParams(body.request ?? ""));
    } catch (e) {
      if (e instanceof OAuthError) throw new HttpError(400, e.message);
      throw e;
    }
    const viewer = await requireViewer();

    if (body.decision !== "allow") {
      return ok({ redirect: redirectWith(authz.redirectUri, { error: "access_denied", state: authz.state, iss: origin }) });
    }

    const repoId = body.repoId ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(repoId)) throw new HttpError(400, "Pick a repository.");
    const repo = await assertRepoAccess(repoId, viewer);

    // The key belongs to a GitHub-identified Slovey user. Locally (no Supabase) the dev
    // viewer stands in for the repository's owner, as it does everywhere else.
    const userId =
      viewer.userId ?? (viewer.isDev && repo.ownerGithubId != null ? await getUserIdByGithubId(repo.ownerGithubId) : null);
    if (!userId) throw new HttpError(403, "Link your GitHub account in Profile first, then try again.");

    const code = mintCode(authz, userId, repoId);
    return ok({ redirect: redirectWith(authz.redirectUri, { code, state: authz.state, iss: origin }) });
  });
}
