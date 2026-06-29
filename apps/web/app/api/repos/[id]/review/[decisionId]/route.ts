import { decisionApi, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve a decision under review: approve (→ confirmed + reinforced) or reject
 * (→ rejected = negative knowledge). Requires write access; audited.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; decisionId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, decisionId } = await ctx.params;
    await assertRepoWrite(id, viewer);
    rateLimit(`review:${viewer.userId ?? viewer.login}`, 60, 60_000);
    const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
    if (body.action !== "approve" && body.action !== "reject") {
      throw new HttpError(400, "action must be 'approve' or 'reject'");
    }
    const row = await decisionApi.review(id, decisionId, body.action, {
      by: viewer.login,
      reason: body.reason,
    });
    if (!row) throw new HttpError(404, "decision not found");
    await logAudit({
      repoId: id,
      actorUser: viewer.login,
      action: `review.${body.action}`,
      targetType: "decision",
      targetId: decisionId,
      metadata: { reason: body.reason ?? null },
    });
    return ok({ id: row.id, status: row.status, review: row.review });
  });
}
