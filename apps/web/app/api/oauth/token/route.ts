import { createApiToken, getUserGithubIdentity, logAudit, resolveRepoById } from "@company-brain/core";
import { CORS_HEADERS, OAuthError, OAUTH_SCOPE, checkClientSecret, parseClient, redeemCode } from "@/lib/server/oauth";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token endpoint: trades a one-time authorization code (plus its PKCE verifier)
 * for a Slovey API key scoped to the repository the user picked. The key does not
 * expire on its own; the user revokes it in Settings, under API keys.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    rateLimit(`oauth-token:${clientIp(req)}`, 60, 60_000);
  } catch {
    return error("too_many_requests", "Slow down and retry shortly.", 429);
  }

  let form: URLSearchParams;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return error("invalid_request", "Request too large.");
    const json = (req.headers.get("content-type") ?? "").includes("application/json");
    form = json ? new URLSearchParams(JSON.parse(raw) as Record<string, string>) : new URLSearchParams(raw);
  } catch {
    return error("invalid_request", "Malformed request body.");
  }

  try {
    if (form.get("grant_type") !== "authorization_code") {
      throw new OAuthError("unsupported_grant_type", "Only authorization_code is supported.");
    }

    // Client authentication: HTTP Basic, form fields, or a public client relying on PKCE.
    let clientId = form.get("client_id");
    let clientSecret = form.get("client_secret");
    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("basic ")) {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      clientId = decodeURIComponent(colon >= 0 ? decoded.slice(0, colon) : decoded);
      clientSecret = colon >= 0 ? decodeURIComponent(decoded.slice(colon + 1)) : null;
    }
    const client = parseClient(clientId);
    if (!clientId || !client) throw new OAuthError("invalid_client", "Unknown client.", 401);
    if (client.confidential && !checkClientSecret(clientId, clientSecret)) {
      throw new OAuthError("invalid_client", "Client authentication failed.", 401);
    }

    const { userId, repoId } = redeemCode({
      code: form.get("code") ?? "",
      clientId,
      redirectUri: form.get("redirect_uri"),
      codeVerifier: form.get("code_verifier") ?? "",
    });

    const repo = await resolveRepoById(repoId);
    if (!repo) throw new OAuthError("invalid_grant", "That repository no longer exists.");
    const key = await createApiToken({ userId, repoId, name: `${client.name} (connector)`.slice(0, 60) });
    const who = await getUserGithubIdentity(userId).catch(() => null);
    await logAudit({
      repoId,
      actorUser: who?.login ?? null,
      action: "token.create",
      targetType: "api_token",
      targetId: key.id,
      metadata: { via: "oauth", client: client.name },
    });

    return Response.json(
      { access_token: key.token, token_type: "Bearer", scope: OAUTH_SCOPE },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  } catch (e) {
    if (e instanceof OAuthError) return error(e.code, e.message, e.status);
    console.error("[api] oauth token error:", e);
    return error("server_error", "Internal error", 500);
  }
}

function error(code: string, description: string, status = 400): Response {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
