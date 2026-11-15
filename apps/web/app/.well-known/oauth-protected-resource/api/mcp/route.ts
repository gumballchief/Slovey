import { CORS_HEADERS, protectedResourceMetadata, publicOrigin } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

/** Path-specific form of the resource metadata (RFC 9728 §3.1), which clients try first for /api/mcp. */
export function GET(req: Request): Response {
  return Response.json(protectedResourceMetadata(publicOrigin(req)), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
