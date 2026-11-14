import { agentRuns, getDb, type AgentRun } from "@company-brain/db";
import { and, desc, eq, lt } from "drizzle-orm";
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

/** A crashed claim is a running row whose heartbeat went stale. Terminal states never qualify. */
export function isStaleAgentRunForRetry(status: string, updatedAt: Date, now: Date = new Date()): boolean {
  return status === "running" && now.getTime() - updatedAt.getTime() > AGENT_RUN_STALE_MS;
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

  try {
    const repo = await resolveRepoById(run.repoId);
    if (!repo) throw new Error("repository no longer connected");
    const r = await runAgentTask({
      repoId: repo.repoId,
      installationId: repo.installationGithubId,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      intent: run.intent,
    });
    try {
      await db
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
        .where(eq(agentRuns.id, runId));
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
        .where(eq(agentRuns.id, runId));
      log.error("agent run ready-update failed", { error: readyMessage, pr: r.prNumber });
      return;
    }
    log.info("agent run ready", { pr: r.prNumber, verdict: r.verdict, reviseRounds: r.reviseRounds, ci: r.ciState });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(agentRuns).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(agentRuns.id, runId));
    log.error("agent run failed", { error: message });
  }
}
