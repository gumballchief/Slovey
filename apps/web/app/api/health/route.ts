import { getSql } from "@company-brain/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness/readiness probe: verifies the DB is reachable. */
export async function GET(): Promise<Response> {
  const started = Date.now();
  try {
    await getSql()`select 1`;
    return Response.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch (err) {
    // Don't leak the raw driver error (host/port/db name/internals) to this
    // unauthenticated probe — log it server-side, return a generic status.
    console.error("[health] db check failed:", err);
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
