import { preflight } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full detail of one Preflight run (checks, errors, fix instructions, violations). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, runId } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const detail = await preflight.getRunDetail(runId);
    if (!detail || detail.run.repoId !== id) throw new HttpError(404, "Run not found");
    return ok(detail);
  });
}
