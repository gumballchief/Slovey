import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Record a dismiss/confirm from the dashboard. Feeds back into retrieval/judging. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json()) as {
      prNumber?: number;
      decisionId?: string;
      action?: "dismiss" | "confirm";
      reason?: string;
    };
    if (body.action !== "dismiss" && body.action !== "confirm") {
      throw new HttpError(400, "action must be 'dismiss' or 'confirm'");
    }
    const row = await dashboard.dashboardFeedback(id, {
      prNumber: body.prNumber,
      decisionId: body.decisionId,
      action: body.action,
      byUser: viewer.login,
      reason: body.reason,
    });
    await logAudit({
      repoId: id,
      actorUser: viewer.login,
      action: `feedback.${body.action}`,
      targetType: "decision",
      targetId: body.decisionId,
      metadata: { prNumber: body.prNumber },
    });
    return ok(row, { status: 201 });
  });
}
