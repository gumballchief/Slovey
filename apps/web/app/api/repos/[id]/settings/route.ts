import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccess, assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    return ok(await dashboard.getSettings(id));
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json()) as Partial<{
      confidenceThreshold: "low" | "high" | "strict";
      triggerOpened: boolean;
      triggerSynchronize: boolean;
      mode: "comment" | "status_check";
      learnFromDismissals: boolean;
    }>;
    const updated = await dashboard.updateSettings(id, body);
    await logAudit({ repoId: id, actorUser: viewer.login, action: "settings.update", metadata: body });
    return ok(updated);
  });
}
