import { enqueue, JOBS, listRepoConnectors, removeConnector, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trigger a re-sync of an already-connected source. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; type: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, type } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const conn = (await listRepoConnectors(id)).find((c) => c.type === type);
    if (!conn) throw new HttpError(404, `${type} is not connected`);
    const jobId = await enqueue(
      JOBS.ingestConnector,
      { repoId: id, connectorId: conn.id },
      { retryLimit: 0 },
    );
    return ok({ jobId, status: "syncing" });
  });
}

/** Disconnect a source (removes the stored, encrypted token). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; type: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, type } = await ctx.params;
    const repo = await assertRepoWrite(id, viewer);
    const removed = await removeConnector(id, type);
    if (removed) {
      await logAudit({
        orgId: repo.orgId,
        repoId: id,
        action: "connector.disconnected",
        actorUser: viewer.login,
        targetType: "connector",
        metadata: { type },
      });
    }
    return ok({ removed });
  });
}
