import { preflight } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent Preflight runs for the repo + full detail of the latest run. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const runs = await preflight.listRuns(id, 20);
    const latest = runs[0] ? await preflight.getRunDetail(runs[0].id) : null;
    return ok({ runs, latest });
  });
}
