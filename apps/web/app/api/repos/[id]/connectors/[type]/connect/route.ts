import { enqueue, JOBS, saveConnector, isConnectorType, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connect a Layer-3 source: store its API token (encrypted at rest) and kick off
 * the first sync. Body: { token, config? }. Only implemented connectors
 * (linear/notion/slack) are accepted; the token is never returned.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; type: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, type } = await ctx.params;
    const repo = await assertRepoWrite(id, viewer);

    if (!isConnectorType(type)) {
      throw new HttpError(400, `${type} can't be connected yet`);
    }
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      config?: { channels?: string[]; baseUrl?: string; email?: string; limit?: number };
    };
    if (!body.token?.trim()) throw new HttpError(400, "token is required");

    const saved = await saveConnector(id, type, body.token, body.config);
    // Don't retry: an auth error won't fix itself, and the UI surfaces lastError
    // and offers a manual re-sync.
    const jobId = await enqueue(
      JOBS.ingestConnector,
      { repoId: id, connectorId: saved.id },
      { retryLimit: 0 },
    );
    await logAudit({
      orgId: repo.orgId,
      repoId: id,
      action: "connector.connected",
      actorUser: viewer.login,
      targetType: "connector",
      targetId: saved.id,
      metadata: { type },
    });
    return ok({ connector: saved, jobId });
  });
}
