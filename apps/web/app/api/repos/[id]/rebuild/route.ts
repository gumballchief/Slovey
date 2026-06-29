import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enqueue a memory rebuild (extract job). Returns the job id + status. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    // Rebuild is expensive (full extract + index + embeddings) — cap it.
    rateLimit(`rebuild:${viewer.userId ?? viewer.login}`, 5, 60_000);
    const { jobId } = await dashboard.enqueueRebuild(id);
    await logAudit({ repoId: id, actorUser: viewer.login, action: "memory.rebuild", metadata: { jobId } });
    return ok({ jobId, status: "queued" }, { status: 202 });
  });
}
