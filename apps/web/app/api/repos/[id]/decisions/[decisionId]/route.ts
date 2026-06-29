import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; decisionId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, decisionId } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json()) as {
      decision?: string;
      why?: string;
      examples?: string[];
      evidence?: string[];
      status?: "approved" | "suggested" | "removed";
    };
    const updated = await dashboard.updateDecision(id, decisionId, body);
    if (!updated) throw new HttpError(404, "Decision not found");
    await logAudit({ repoId: id, actorUser: viewer.login, action: "decision.update", targetType: "decision", targetId: decisionId });
    return ok(updated);
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; decisionId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, decisionId } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const removed = await dashboard.removeDecision(id, decisionId);
    if (!removed) throw new HttpError(404, "Decision not found");
    await logAudit({ repoId: id, actorUser: viewer.login, action: "decision.remove", targetType: "decision", targetId: decisionId });
    return ok({ ok: true });
  });
}
