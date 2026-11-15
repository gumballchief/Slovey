import { CORS_HEADERS, protectedResourceMetadata, publicOrigin } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

/** Protected resource metadata (RFC 9728): tells MCP clients the MCP endpoint signs in with Slovey. */
export function GET(req: Request): Response {
  return Response.json(protectedResourceMetadata(publicOrigin(req)), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
