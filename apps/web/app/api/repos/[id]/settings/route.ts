import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccess, assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";

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
    const { role } = await assertRepoAccessWithRole(id, viewer);
    if (role !== "owner" && role !== "admin") throw new HttpError(403, "Forbidden");
    const body = await readJsonBody<Partial<{
      confidenceThreshold: "low" | "high" | "strict";
      triggerOpened: boolean;
      triggerSynchronize: boolean;
      mode: "comment" | "status_check";
      learnFromDismissals: boolean;
    }>>(req);
    if (
      body.confidenceThreshold !== undefined &&
      body.confidenceThreshold !== "low" &&
      body.confidenceThreshold !== "high" &&
      body.confidenceThreshold !== "strict"
    ) {
      throw new HttpError(400, "Invalid confidenceThreshold.");
    }
    if (body.triggerOpened !== undefined && typeof body.triggerOpened !== "boolean") {
      throw new HttpError(400, "Invalid triggerOpened.");
    }
    if (body.triggerSynchronize !== undefined && typeof body.triggerSynchronize !== "boolean") {
      throw new HttpError(400, "Invalid triggerSynchronize.");
    }
    if (body.mode !== undefined && body.mode !== "comment" && body.mode !== "status_check") {
      throw new HttpError(400, "Invalid mode.");
    }
    if (body.learnFromDismissals !== undefined && typeof body.learnFromDismissals !== "boolean") {
      throw new HttpError(400, "Invalid learnFromDismissals.");
    }
    const update = {
      ...(body.confidenceThreshold !== undefined ? { confidenceThreshold: body.confidenceThreshold } : {}),
      ...(body.triggerOpened !== undefined ? { triggerOpened: body.triggerOpened } : {}),
      ...(body.triggerSynchronize !== undefined ? { triggerSynchronize: body.triggerSynchronize } : {}),
      ...(body.mode !== undefined ? { mode: body.mode } : {}),
      ...(body.learnFromDismissals !== undefined ? { learnFromDismissals: body.learnFromDismissals } : {}),
    };
    const updated = await dashboard.updateSettings(id, update);
    await logAudit({ repoId: id, actorUser: viewer.login, action: "settings.update", metadata: update });
    return ok(updated);
  });
}
