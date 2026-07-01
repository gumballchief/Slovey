import { JOBS, createAgentRun, enqueue, listAgentRuns } from "@company-brain/core";
import { assertRepoAccess, assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent agent runs for the repo (newest first). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    return ok(await listAgentRuns(id, 25));
  });
}

/** Create an agent task: persist a queued run, then enqueue it for the worker. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json()) as { intent?: string };
    const intent = body.intent?.trim() ?? "";
    if (!intent) throw new HttpError(400, "intent is required");
    if (intent.length > 500) throw new HttpError(400, "intent is too long (max 500 characters)");
    const run = await createAgentRun({ repoId: id, intent, requestedBy: viewer.login });
    await enqueue(JOBS.agentTask, { runId: run.id }, { retryLimit: 0 });
    return ok(run, { status: 201 });
  });
}
