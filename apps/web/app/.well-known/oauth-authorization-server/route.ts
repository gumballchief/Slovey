import { CORS_HEADERS, authorizationServerMetadata, publicOrigin } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

/** OAuth authorization server metadata (RFC 8414): how MCP clients find "Sign in with Slovey". */
export function GET(req: Request): Response {
  return Response.json(authorizationServerMetadata(publicOrigin(req)), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
