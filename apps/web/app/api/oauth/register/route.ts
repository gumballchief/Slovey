import { CORS_HEADERS, OAuthError, OAUTH_SCOPE, registerClient } from "@/lib/server/oauth";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dynamic client registration (RFC 7591). Claude and other MCP clients register
 * themselves before sending the user to sign in. Nothing is stored: the client id
 * is signed and carries the registered redirect URIs.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    rateLimit(`oauth-register:${clientIp(req)}`, 30, 60_000);
  } catch {
    return error("too_many_requests", "Slow down and retry shortly.", 429);
  }
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return error("invalid_client_metadata", "Registration body too large.");
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return error("invalid_client_metadata", "Body must be JSON.");
  }
  try {
    const { clientId, clientSecret, client } = registerClient(body);
    return Response.json(
      {
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: client.confidential ? String(body.token_endpoint_auth_method) : "none",
        scope: OAUTH_SCOPE,
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e) {
    if (e instanceof OAuthError) return error(e.code, e.message, e.status);
    console.error("[api] oauth register error:", e);
    return error("server_error", "Internal error", 500);
  }
}

function error(code: string, description: string, status = 400): Response {
  return Response.json({ error: code, error_description: description }, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
