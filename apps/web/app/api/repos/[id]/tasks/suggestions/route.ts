import { resolveRepoById, suggestTasks } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Proactive agent tasks mined from rejected decisions still present in the code. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const repo = await resolveRepoById(id);
    if (!repo) throw new HttpError(404, "Repo not found");
    return ok(await suggestTasks(repo));
  });
}
