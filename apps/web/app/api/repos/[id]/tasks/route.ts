import { JOBS, countPendingAgentRuns, createAgentRun, dashboard, enqueue, failQueuedAgentRun, listAgentRuns } from "@company-brain/core";
import { assertRepoAccess, assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serialize quota check + run creation per org (see POST below). */
const orgRunLocks = new Map<string, Promise<void>>();
async function withOrgRunLock<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  const previous = orgRunLocks.get(orgId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  orgRunLocks.set(orgId, chained);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (orgRunLocks.get(orgId) === chained) orgRunLocks.delete(orgId);
  }
}

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
    const body = await readJsonBody<{ intent?: string }>(req, 10_000);
    const intent = body.intent?.trim() ?? "";
    if (!intent) throw new HttpError(400, "intent is required");
    if (intent.length > 500) throw new HttpError(400, "intent is too long (max 500 characters)");
    // Plan gating: agent runs are metered per org per calendar month.
    const org = await dashboard.getOrgForRepo(id);
    if (!org) {
      throw new HttpError(403, "Repo is not linked to an organization");
    }
    const billing = await dashboard.getOrgStripe(org.id);
    const plan = billing?.plan ?? "free";
    const limit = dashboard.AGENT_RUNS_PER_MONTH[plan];
    // Hold a per-org lock across the count check and the insert so parallel
    // requests cannot all observe used < limit before any run is persisted.
    // The persisted run is counted by countAgentRunsThisMonth once created,
    // so the next lock holder sees it. Enqueue stays after the lock.
    const run = await withOrgRunLock(org.id, async () => {
      // Per-org/repo flood control: applies to all plans (incl. unlimited).
      rateLimit(`agent-tasks:org:${org.id}`, 20, 60_000);
      rateLimit(`agent-tasks:repo:${id}`, 10, 60_000);
      // Count pending over all runs in SQL: a newest-N page would let completed
      // runs push still-running tasks out of the window.
      const pending = await countPendingAgentRuns(id);
      if (pending >= 5) {
        throw new HttpError(429, "Too many pending agent tasks for this repo. Wait for existing runs to finish.");
      }
      if (limit >= 0) {
        const used = await dashboard.countAgentRunsThisMonth(org.id);
        if (used >= limit) {
          throw new HttpError(402, `Monthly agent-run limit reached (${used}/${limit} on the ${plan} plan). Upgrade on the Billing page.`);
        }
      }
      return createAgentRun({ repoId: id, intent, requestedBy: viewer.login });
    });
    try {
      await enqueue(JOBS.agentTask, { runId: run.id }, { retryLimit: 0 });
    } catch (enqueueError) {
      // Without this the orphan "queued" row would hold one of the 5 pending slots forever.
      try {
        await failQueuedAgentRun(run.id, "Could not queue the task. Please try again.");
      } catch {
        // Best-effort cleanup only; preserve the original enqueue failure below.
      }
      throw enqueueError;
    }
    return ok(run, { status: 201 });
  });
}
