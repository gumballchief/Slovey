import { AGENT_PIPELINE, agentForCheck, preflight } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent Preflight runs for the repo + full detail of the latest run.
 *  Checks are annotated with their owning supervisor agent (derived from the
 *  registry — the DB rows don't store it) so the UI can render the pipeline. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const runs = await preflight.listRuns(id, 20);
    const detail = runs[0] ? await preflight.getRunDetail(runs[0].id) : null;
    const latest = detail
      ? { ...detail, checks: detail.checks.map((c) => ({ ...c, agent: agentForCheck(c.name) })) }
      : null;
    return ok({ runs, latest, pipeline: [...AGENT_PIPELINE] });
  });
}
