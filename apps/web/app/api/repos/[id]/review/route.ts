import { decisionApi } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The review queue — AI-proposed / candidate / unconfirmed decisions awaiting a
 * human verdict. This is where the graph becomes the system of record.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const rows = await decisionApi.reviewQueue(id);
    return ok(
      rows.map((r) => ({
        id: r.id,
        decision: r.decision,
        why: r.why,
        evidence: r.evidence ?? [],
        source: r.source,
        status: r.status,
        confidence: Number((r.confidence ?? 0).toFixed(2)),
        importance: r.importance,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  });
}
