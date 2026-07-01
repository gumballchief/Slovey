import {
  getDb,
  preflightAttempts,
  preflightChecks,
  preflightDecisionViolations,
  preflightErrors,
  preflightRuns,
} from "@company-brain/db";
import { and, desc, eq } from "drizzle-orm";
import type { CheckResult, PreflightResult } from "./types";

export async function getLatestRun(repoId: string, branch: string | null) {
  const db = getDb();
  const where = branch
    ? and(eq(preflightRuns.repoId, repoId), eq(preflightRuns.branch, branch))
    : eq(preflightRuns.repoId, repoId);
  const [row] = await db.select().from(preflightRuns).where(where).orderBy(desc(preflightRuns.createdAt)).limit(1);
  return row ?? null;
}

export async function getLatestAttempt(repoId: string, branch: string | null) {
  const db = getDb();
  const where = branch
    ? and(eq(preflightAttempts.repoId, repoId), eq(preflightAttempts.branch, branch))
    : eq(preflightAttempts.repoId, repoId);
  const [row] = await db.select().from(preflightAttempts).where(where).orderBy(desc(preflightAttempts.createdAt)).limit(1);
  return row ?? null;
}

/** Latest run + its checks/errors/violations, for the dashboard and status tools. */
export async function getRunDetail(runId: string) {
  const db = getDb();
  const [run] = await db.select().from(preflightRuns).where(eq(preflightRuns.id, runId)).limit(1);
  if (!run) return null;
  const [checks, errors, violations] = await Promise.all([
    db.select().from(preflightChecks).where(eq(preflightChecks.runId, runId)),
    db.select().from(preflightErrors).where(eq(preflightErrors.runId, runId)),
    db.select().from(preflightDecisionViolations).where(eq(preflightDecisionViolations.runId, runId)),
  ]);
  return { run, checks, errors, violations };
}

/** Find one stored error by its fingerprint (for `preflight explain <errorId>`). */
export async function findErrorByFingerprint(repoId: string, fp: string) {
  const db = getDb();
  const rows = await db
    .select({
      error: preflightErrors,
      runId: preflightRuns.id,
      branch: preflightRuns.branch,
      createdAt: preflightRuns.createdAt,
    })
    .from(preflightErrors)
    .innerJoin(preflightRuns, eq(preflightErrors.runId, preflightRuns.id))
    .where(and(eq(preflightRuns.repoId, repoId), eq(preflightErrors.fingerprint, fp)))
    .orderBy(desc(preflightRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Recent runs for a repo (dashboard list). */
export async function listRuns(repoId: string, limit = 20) {
  const db = getDb();
  return db.select().from(preflightRuns).where(eq(preflightRuns.repoId, repoId)).orderBy(desc(preflightRuns.createdAt)).limit(limit);
}

export async function persistRun(input: {
  repoId: string;
  result: PreflightResult;
  checks: CheckResult[];
  signature: string;
  changedFiles: string[];
}): Promise<string> {
  const db = getDb();
  const { repoId, result, checks, signature, changedFiles } = input;

  const [run] = await db
    .insert(preflightRuns)
    .values({
      repoId,
      branch: result.branch,
      commitSha: result.commitSha,
      mode: result.mode,
      status: result.status,
      safeToCommit: result.safeToCommit,
      safeToPush: result.safeToPush,
      summary: result.summary,
      agentInstruction: result.agentInstruction,
      attemptId: result.attempt.attemptId,
      attempt: result.attempt.attemptNumber,
      maxAttempts: result.attempt.maxAttempts,
      humanReviewRequired: result.humanReviewRequired,
      durationMs: checks.reduce((s, c) => s + c.durationMs, 0),
    })
    .returning({ id: preflightRuns.id });
  const runId = run!.id;

  if (checks.length) {
    await db.insert(preflightChecks).values(
      checks.map((c) => ({
        runId,
        name: c.name,
        status: c.status,
        command: c.command,
        blocking: c.blocking,
        durationMs: c.durationMs,
        skippedReason: c.skippedReason ?? null,
        stdoutSummary: c.stdoutSummary ?? null,
        stderrSummary: c.stderrSummary ?? null,
      })),
    );
  }
  // One row per fix instruction, joined back to its parsed error where possible.
  if (result.fixInstructions.length) {
    const errorsByFp = new Map(result.checks.flatMap((c) => c.errors.map((e) => [e.id ?? "", e] as const)));
    await db.insert(preflightErrors).values(
      result.fixInstructions.map((f) => {
        const e = errorsByFp.get(f.id);
        return {
          runId,
          checkName: f.checkId ?? f.evidence.split(" · ")[0] ?? "check",
          file: f.file,
          line: e?.line ?? null,
          code: e?.code ?? null,
          category: e?.category ?? null,
          fingerprint: f.id,
          message: f.problem,
          rawRedacted: e?.raw ?? null,
          priority: f.priority,
          instructionForAgent: f.instructionForAgent,
          evidence: f.evidence,
        };
      }),
    );
  }
  if (result.decisionViolations.length) {
    await db.insert(preflightDecisionViolations).values(
      result.decisionViolations.map((v) => ({
        runId,
        decisionId: v.decisionId,
        title: v.title,
        violation: v.violation,
        instructionForAgent: v.instructionForAgent,
        confidence: v.confidence,
        evidence: v.evidence,
      })),
    );
  }
  await db.insert(preflightAttempts).values({
    repoId,
    runId,
    branch: result.branch,
    attemptId: result.attempt.attemptId,
    attempt: result.attempt.attemptNumber,
    signature,
    changedFiles,
    repeatedFailure: result.attempt.repeatedFailure,
    unrelatedChangesDetected: result.attempt.unrelatedChangesDetected,
    humanReviewRequired: result.humanReviewRequired,
  });
  return runId;
}
