import { agentRuns, getDb, type AgentRun } from "@company-brain/db";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { logger } from "../logger";
import { runAgentTask } from "../pipelines/agent";
import { resolveRepoById } from "./sync";

/** Create a queued run row (the dashboard enqueues the job right after). */
export async function createAgentRun(input: {
  repoId: string;
  intent: string;
  requestedBy?: string | null;
}): Promise<AgentRun> {
  const db = getDb();
  const [row] = await db
    .insert(agentRuns)
    .values({ repoId: input.repoId, intent: input.intent, requestedBy: input.requestedBy ?? null })
    .returning();
  return row!;
}

/** Queued + running runs for a repo (the per-repo pending cap), counted in SQL. */
export async function countPendingAgentRuns(repoId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentRuns)
    .where(and(eq(agentRuns.repoId, repoId), inArray(agentRuns.status, ["queued", "running"])));
  return row?.n ?? 0;
}

/** Fail a run that never left "queued" (e.g. its job could not be enqueued) so it stops holding a pending slot. */
export async function failQueuedAgentRun(runId: string, error: string): Promise<void> {
  const db = getDb();
  await db
    .update(agentRuns)
    .set({ status: "failed", error, updatedAt: new Date() })
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "queued")));
}

export async function listAgentRuns(repoId: string, limit = 20): Promise<AgentRun[]> {
  const db = getDb();
  return db.select().from(agentRuns).where(eq(agentRuns.repoId, repoId)).orderBy(desc(agentRuns.createdAt)).limit(limit);
}

/**
 * Worker-side executor: load the queued run, mark it running, drive the agent
 * pipeline, and persist the outcome (ready with PR details, or failed with the
 * error). Idempotent-ish: terminal runs (ready/failed) or a freshly claimed
 * running run are skipped so a pg-boss retry can't open a duplicate PR. A
 * stale running run (worker crashed between claim and outcome) is reclaimed
 * so the retry re-executes instead of sticking in running forever.
 */
export const AGENT_RUN_STALE_MS = 10 * 60 * 1000;

/** Heartbeat interval for a running agent task; must stay well under the stale timeout. */
export const AGENT_RUN_HEARTBEAT_MS = 60 * 1000;

/** A crashed claim is a running row whose heartbeat went stale. Terminal states never qualify. */
export function isStaleAgentRunForRetry(status: string, updatedAt: Date, now: Date = new Date()): boolean {
  return status === "running" && now.getTime() - updatedAt.getTime() > AGENT_RUN_STALE_MS;
}

/** True when the row still carries our last heartbeat (nobody reclaimed it since). */
export function isAgentRunStillOwned(currentUpdatedAt: Date, lastHeartbeat: Date): boolean {
  return currentUpdatedAt.getTime() === lastHeartbeat.getTime();
}

/**
 * Reconcile the ownership token after a heartbeat error. A lost response may
 * mean the UPDATE committed (row now carries the beat) or failed (row still
 * carries the previous heartbeat), so the caller re-SELECTs updatedAt. Only
 * our own beat is adopted: any other value means another worker reclaimed the
 * run, so we keep the old token and our final update correctly misses.
 */
export function resolveHeartbeatAfterError(expected: Date, beat: Date, currentUpdatedAt: Date | null): Date {
  if (currentUpdatedAt && currentUpdatedAt.getTime() === beat.getTime()) return new Date(beat);
  return expected;
}

/**
 * Stop heartbeating and wait for a beat already in flight to land. Without
 * settling, an in-flight beat can change updatedAt after the final update's
 * ownership token is read, making that update miss its own row: the run is
 * left "running" despite having opened a PR, so a later stale reclaim
 * re-executes it and opens a duplicate.
 */
export async function settleAgentRunHeartbeat(
  clearTimer: () => void,
  inFlight: Promise<void> | null,
): Promise<void> {
  clearTimer();
  await inFlight;
}

export async function executeAgentRun(runId: string): Promise<void> {
  const db = getDb();
  const log = logger.child({ component: "agent-run", runId });

  const [queuedClaim] = await db
    .update(agentRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "queued")))
    .returning();
  let run = queuedClaim;
  if (!run) {
    const staleBefore = new Date(Date.now() - AGENT_RUN_STALE_MS);
    const [reclaimed] = await db
      .update(agentRuns)
      .set({ status: "running", updatedAt: new Date() })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running"), lt(agentRuns.updatedAt, staleBefore)))
      .returning();
    if (!reclaimed) {
      log.info("agent run already processed; skipping");
      return;
    }
    log.info("agent run reclaimed after stale running; retrying");
    run = reclaimed;
  }

  let lastHeartbeat = new Date(run.updatedAt);
  let heartbeatInFlight: Promise<void> | null = null;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight) return;
    const beat = new Date();
    const expected = lastHeartbeat;
    heartbeatInFlight = db
      .update(agentRuns)
      .set({ updatedAt: beat })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running"), eq(agentRuns.updatedAt, expected)))
      .returning()
      .then((rows) => {
        const beatUpdatedAt = rows[0]?.updatedAt;
        if (rows.length > 0 && beatUpdatedAt) lastHeartbeat = new Date(beatUpdatedAt);
      })
      .catch(async () => {
        try {
          const [current] = await db
            .select({ updatedAt: agentRuns.updatedAt })
            .from(agentRuns)
            .where(eq(agentRuns.id, runId))
            .limit(1);
          lastHeartbeat = resolveHeartbeatAfterError(expected, beat, current?.updatedAt ?? null);
        } catch {
          /* keep the last known heartbeat when the resync read fails */
        }
      })
      .then(() => {
        heartbeatInFlight = null;
      });
  }, AGENT_RUN_HEARTBEAT_MS);
  const stopHeartbeat = async (): Promise<void> => {
    await settleAgentRunHeartbeat(() => clearInterval(heartbeatTimer), heartbeatInFlight);
  };
  const timerWithUnref = heartbeatTimer as unknown as { unref?: () => void };
  if (typeof timerWithUnref.unref === "function") timerWithUnref.unref();

  try {
    const repo = await resolveRepoById(run.repoId);
    if (!repo) throw new Error("repository no longer connected");
    let r: Awaited<ReturnType<typeof runAgentTask>>;
    try {
      r = await runAgentTask({
        repoId: repo.repoId,
        installationId: repo.installationGithubId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        intent: run.intent,
      });
    } finally {
      await stopHeartbeat();
    }
    const ownedHeartbeat = lastHeartbeat;
    const ownedWhere = and(
      eq(agentRuns.id, runId),
      eq(agentRuns.status, "running"),
      eq(agentRuns.updatedAt, ownedHeartbeat),
    );
    try {
      const [readyRow] = await db
        .update(agentRuns)
        .set({
          status: "ready",
          branch: r.branch,
          prNumber: r.prNumber,
          prUrl: r.prUrl,
          draft: r.draft,
          filePath: r.path,
          isNewFile: r.isNew,
          files: r.files,
          decisionsUsed: r.decisionsUsed,
          verdict: r.verdict ?? null,
          reviewPosted: r.reviewPosted,
          reviseRounds: r.reviseRounds,
          ciState: r.ciState,
          ciSummary: r.ciSummary,
          updatedAt: new Date(),
        })
        .where(ownedWhere)
        .returning();
      if (!readyRow) {
        log.info("agent run ownership lost; skipping ready update");
        return;
      }
    } catch (readyErr) {
      const readyMessage = readyErr instanceof Error ? readyErr.message : String(readyErr);
      await db
        .update(agentRuns)
        .set({
          status: "failed",
          error: readyMessage,
          branch: r.branch,
          prNumber: r.prNumber,
          prUrl: r.prUrl,
          draft: r.draft,
          filePath: r.path,
          isNewFile: r.isNew,
          files: r.files,
          decisionsUsed: r.decisionsUsed,
          verdict: r.verdict ?? null,
          reviewPosted: r.reviewPosted,
          reviseRounds: r.reviseRounds,
          ciState: r.ciState,
          ciSummary: r.ciSummary,
          updatedAt: new Date(),
        })
        .where(ownedWhere);
      log.error("agent run ready-update failed", { error: readyMessage, pr: r.prNumber });
      return;
    }
    log.info("agent run ready", { pr: r.prNumber, verdict: r.verdict, reviseRounds: r.reviseRounds, ci: r.ciState });
  } catch (e) {
    await stopHeartbeat();
    const message = e instanceof Error ? e.message : String(e);
    const failedHeartbeat = lastHeartbeat;
    await db
      .update(agentRuns)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running"), eq(agentRuns.updatedAt, failedHeartbeat)));
    log.error("agent run failed", { error: message });
  }
}
