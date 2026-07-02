import {
  getDb,
  preflightAttempts,
  preflightChecks,
  preflightDecisionViolations,
  preflightErrors,
  preflightFixInstructions,
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

/** Latest run + its checks/errors/fixes/violations, for the dashboard and status tools. */
export async function getRunDetail(runId: string) {
  const db = getDb();
  const [run] = await db.select().from(preflightRuns).where(eq(preflightRuns.id, runId)).limit(1);
  if (!run) return null;
  const [checks, errors, fixInstructions, violations] = await Promise.all([
    db.select().from(preflightChecks).where(eq(preflightChecks.runId, runId)),
    db.select().from(preflightErrors).where(eq(preflightErrors.runId, runId)),
    db.select().from(preflightFixInstructions).where(eq(preflightFixInstructions.runId, runId)),
    db.select().from(preflightDecisionViolations).where(eq(preflightDecisionViolations.runId, runId)),
  ]);
  return { run, checks, errors, fixInstructions, violations };
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

  // Checks (returning ids so raw errors can link to the exact check row).
  const checkIdByName = new Map<string, string>();
  if (checks.length) {
    const rows = await db
      .insert(preflightChecks)
      .values(
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
      )
      .returning({ id: preflightChecks.id, name: preflightChecks.name });
    for (const r of rows) checkIdByName.set(r.name, r.id);
  }
  // Raw parsed errors, one per parser hit, linked to their check.
  const errorRows = checks.flatMap((c) =>
    c.errors.map((e) => ({
      runId,
      checkId: checkIdByName.get(c.name) ?? null,
      checkName: c.name,
      file: e.file,
      line: e.line ?? null,
      col: e.column ?? null,
      code: e.code ?? null,
      category: e.category ?? null,
      fingerprint: e.id ?? null,
      message: e.message,
      rawRedacted: e.raw ?? null,
      blocking: c.blocking,
    })),
  );
  if (errorRows.length) await db.insert(preflightErrors).values(errorRows.slice(0, 200));
  // Agent-directed fix instructions (already deduped by fingerprint).
  if (result.fixInstructions.length) {
    await db.insert(preflightFixInstructions).values(
      result.fixInstructions.map((f) => ({
        runId,
        fingerprint: f.id,
        checkName: f.checkId ?? null,
        priority: f.priority,
        file: f.file,
        problem: f.problem,
        instructionForAgent: f.instructionForAgent,
        evidence: f.evidence,
      })),
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
