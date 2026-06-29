import { graph } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full decision node: the decision + its graph edges (in/out) + version timeline. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; decisionId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, decisionId } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const node = await graph.getDecision(id, decisionId);
    if (!node) throw new HttpError(404, "Decision not found");
    const timeline = await graph.timeline(id, decisionId);
    return ok({ ...node, timeline });
  });
}
