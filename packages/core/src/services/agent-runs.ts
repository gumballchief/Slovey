import { agentRuns, getDb, type AgentRun } from "@company-brain/db";
import { desc, eq } from "drizzle-orm";
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
 * error). Idempotent-ish: a run that already left "queued" is skipped so a
 * pg-boss retry can't open a duplicate PR.
 */
export async function executeAgentRun(runId: string): Promise<void> {
  const db = getDb();
  const log = logger.child({ component: "agent-run", runId });

  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1);
  if (!run) {
    log.warn("agent run not found");
    return;
  }
  if (run.status !== "queued") {
    log.info("agent run already processed; skipping", { status: run.status });
    return;
  }

  await db.update(agentRuns).set({ status: "running", updatedAt: new Date() }).where(eq(agentRuns.id, runId));

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
        decisionsUsed: r.decisionsUsed,
        verdict: r.verdict ?? null,
        reviewPosted: r.reviewPosted,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
    log.info("agent run ready", { pr: r.prNumber, verdict: r.verdict });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(agentRuns).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(agentRuns.id, runId));
    log.error("agent run failed", { error: message });
  }
}
