import { loadEnv, type ConfidenceThreshold } from "@company-brain/config";
import { getDb, prChecks, repoSettings } from "@company-brain/db";
import { and, eq } from "drizzle-orm";
import { getAI } from "../ai";
import { judgePrompt } from "../ai/prompts";
import type { JudgeResult } from "../ai/types";
import { getInstallationOctokit } from "../github/app";
import {
  fetchPrForCheck,
  findBotComment,
  postOrUpdateComment,
} from "../github/fetchers";
import { guardWarning, type CitableDecision } from "../guardrails/citation";
import { logAudit } from "../services/audit";
import { isRepoWithinPlan } from "../services/plan-guard";
import { buildComment, buildResolvedComment, COMMENT_MARKER } from "./comment";
import { getDismissedNotes } from "./feedback";
import { categorizePr, retrieveDecisions } from "./retrieve";

export interface CheckPrParams {
  repoId: string;
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  prNumber: number;
  action?: "opened" | "synchronize" | "manual";
}

export interface CheckPrResult {
  verdict: "conflict" | "clear" | "skipped";
  posted: boolean;
  reason: string;
  checkId?: string;
}

interface EffectiveSettings {
  confidenceThreshold: ConfidenceThreshold;
  triggerSynchronize: boolean;
  mode: "comment" | "status_check";
  learnFromDismissals: boolean;
}

async function loadSettings(repoId: string): Promise<EffectiveSettings> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.repoId, repoId))
    .limit(1);
  return {
    confidenceThreshold: (row?.confidenceThreshold ?? "high") as ConfidenceThreshold,
    triggerSynchronize: row?.triggerSynchronize ?? false,
    mode: (row?.mode ?? "comment") as "comment" | "status_check",
    learnFromDismissals: row?.learnFromDismissals ?? true,
  };
}

/** Map a verdict to the GitHub commit-status to publish (status_check mode). */
export function statusForVerdict(
  verdict: CheckPrResult["verdict"],
  explanation?: string | null,
): { state: "success" | "failure" | "pending"; description: string } {
  if (verdict === "conflict") {
    return {
      state: "failure",
      description: (explanation ?? "Conflicts with a past team decision").slice(0, 140),
    };
  }
  if (verdict === "clear") {
    return { state: "success", description: "No conflicts with past team decisions" };
  }
  return { state: "pending", description: "Company Brain check pending" };
}

function postingAllowed(fullName: string): boolean {
  const env = loadEnv();
  const allow = env.ALLOWLIST_REPOS;
  if (allow.length === 0) return true; // empty = unrestricted (set a list in dev!)
  return allow.includes(fullName.toLowerCase());
}

/**
 * The check pipeline. Retrieves → judges → enforces confidence floor + citation
 * guardrail → posts a single cited comment (or status check) → records the result.
 * Idempotent on (repo, pr, head sha); never double-comments.
 */
export async function checkPr(params: CheckPrParams): Promise<CheckPrResult> {
  const db = getDb();
  const settings = await loadSettings(params.repoId);

  if (params.action === "synchronize" && !settings.triggerSynchronize) {
    return { verdict: "skipped", posted: false, reason: "synchronize-disabled" };
  }

  // Plan enforcement: repos beyond the org's allowance don't get PR checks.
  const gate = await isRepoWithinPlan(params.repoId);
  if (!gate.ok) {
    return { verdict: "skipped", posted: false, reason: `plan-limit (${gate.plan}: ${gate.limit} repos)` };
  }

  const octokit = await getInstallationOctokit(params.installationId);
  const pr = await fetchPrForCheck(octokit, params.owner, params.name, params.prNumber);

  // Idempotency: already processed this exact head sha?
  const existing = await db
    .select({ id: prChecks.id, verdict: prChecks.verdict })
    .from(prChecks)
    .where(
      and(
        eq(prChecks.repoId, params.repoId),
        eq(prChecks.prNumber, params.prNumber),
        eq(prChecks.headSha, pr.headSha),
      ),
    )
    .limit(1);
  // A prior "skipped" row means the judge transiently failed — allow a re-run so
  // the check can self-heal. A real clear/conflict result stays idempotent.
  if (existing.length > 0 && existing[0]!.verdict !== "skipped") {
    return { verdict: "skipped", posted: false, reason: "already-checked", checkId: existing[0]!.id };
  }

  // status_check mode: show a pending status immediately so the (potentially
  // required) check appears as in-progress while the judge runs.
  if (settings.mode === "status_check" && postingAllowed(params.fullName)) {
    try {
      await octokit.rest.repos.createCommitStatus({
        owner: params.owner,
        repo: params.name,
        sha: pr.headSha,
        state: "pending",
        context: "company-brain",
        description: "Company Brain is checking this PR…",
      });
    } catch {
      // best-effort; the final status below is what matters
    }
  }

  const category = await categorizePr(pr);
  const retrieved = await retrieveDecisions(params.repoId, { ...pr, category });

  const dismissedNotes = settings.learnFromDismissals
    ? await getDismissedNotes(params.repoId)
    : [];

  let verdict: CheckPrResult["verdict"] = "clear";
  let posted = false;
  let reason = "clear";
  let matchedDecisionId: string | null = null;
  let matchedDecisionText: string | null = null;
  let citation: string | null = null;
  let confidence: string | null = null;
  let explanation: string | null = null;
  let severity: string | null = null;
  let suggestedFix: string | null = null;
  let commentId: number | null = null;

  if (retrieved.length === 0) {
    reason = "no-decisions";
  } else {
    const judgeInputs = retrieved.map((d) => ({
      decision: d.decision,
      examples: d.examples,
      evidence: d.evidence,
    }));
    const result = await getAI().completeJSON<JudgeResult>(
      judgePrompt(judgeInputs, pr, dismissedNotes),
      { tier: "premium", maxTokens: 400 },
    );

    if (!result) {
      verdict = "skipped";
      reason = "judge-failed";
    } else {
      confidence = result.confidence;
      explanation = result.explanation;
      severity = result.severity ?? null;
      suggestedFix = result.suggestedFix ?? null;
      const citable: CitableDecision[] = retrieved.map((d) => ({
        id: d.id,
        decision: d.decision,
        evidence: d.evidence,
      }));
      const guard = guardWarning(result, citable, settings.confidenceThreshold);
      reason = guard.reason;

      if (guard.post && guard.matched) {
        // Hard dismissal guardrail: if the team explicitly dismissed this exact
        // decision, stay silent — don't let the judge re-warn about it. (The
        // dismissed notes are also fed to the judge as a soft negative above, but
        // a strong conflict can override that, so this makes /brain dismiss stick.)
        if (settings.learnFromDismissals && dismissedNotes.includes(guard.matched.decision)) {
          reason = "decision-dismissed";
        } else {
          verdict = "conflict";
          matchedDecisionId = guard.matched.id;
          matchedDecisionText = guard.matched.decision;
          citation = result.evidence;
        }
      }
    }
  }

  // Surface the result. comment mode posts a single cited comment, only on a
  // conflict. status_check mode always sets a commit status — failure on a
  // conflict, success on a clear PR — so it works as a required merge gate
  // (without a success status a required check would block every clean PR).
  if (postingAllowed(params.fullName)) {
    if (settings.mode === "status_check") {
      if (verdict === "conflict" || verdict === "clear") {
        const { state, description } = statusForVerdict(verdict, explanation);
        await octokit.rest.repos.createCommitStatus({
          owner: params.owner,
          repo: params.name,
          sha: pr.headSha,
          state,
          context: "company-brain",
          description,
        });
        posted = verdict === "conflict";
      } else {
        // verdict "skipped" (judge failed): the "pending" status posted above
        // would otherwise stick forever and block a required merge gate. Resolve
        // it to an honest error; the row stays "skipped" so the next push/rescan
        // re-runs and produces a real success/failure.
        await octokit.rest.repos
          .createCommitStatus({
            owner: params.owner,
            repo: params.name,
            sha: pr.headSha,
            state: "error",
            context: "company-brain",
            description: "Company Brain couldn't complete the check — it will retry.",
          })
          .catch(() => {});
      }
    } else if (verdict === "conflict" && matchedDecisionText) {
      const body = buildComment({
        explanation: explanation ?? "",
        decision: matchedDecisionText,
        citation: citation ?? "",
        confidence: confidence ?? "",
        severity: severity ?? undefined,
        suggestedFix: suggestedFix ?? undefined,
      });
      const existingComment = await findBotComment(
        octokit,
        params.owner,
        params.name,
        params.prNumber,
        COMMENT_MARKER,
      );
      commentId = await postOrUpdateComment(
        octokit,
        params.owner,
        params.name,
        params.prNumber,
        body,
        existingComment,
      );
      posted = true;
    } else if (verdict === "clear") {
      // Genuinely re-checked and clear — if we previously warned on this PR,
      // replace that stale comment with a resolved note. NOT done for "skipped"
      // (judge failure): that would falsely mark an unresolved conflict as fixed.
      const existingComment = await findBotComment(
        octokit,
        params.owner,
        params.name,
        params.prNumber,
        COMMENT_MARKER,
      );
      if (existingComment) {
        await postOrUpdateComment(
          octokit,
          params.owner,
          params.name,
          params.prNumber,
          buildResolvedComment(reason),
          existingComment,
        );
        commentId = existingComment;
      }
    }
  } else if (verdict === "conflict") {
    reason = "repo-not-in-allowlist";
  }

  const [inserted] = await db
    .insert(prChecks)
    .values({
      repoId: params.repoId,
      prNumber: params.prNumber,
      prTitle: pr.title,
      prAuthor: pr.author,
      headSha: pr.headSha,
      verdict,
      matchedDecisionId,
      confidence,
      severity,
      explanation,
      suggestedFix,
      githubCommentId: commentId,
      posted,
    })
    .onConflictDoUpdate({
      target: [prChecks.repoId, prChecks.prNumber, prChecks.headSha],
      set: { verdict, matchedDecisionId, confidence, severity, explanation, suggestedFix, githubCommentId: commentId, posted },
    })
    .returning({ id: prChecks.id });

  await logAudit({
    repoId: params.repoId,
    actorUser: "company-brain[bot]",
    action: posted ? "pr.commented" : "pr.checked",
    targetType: "pr_check",
    targetId: inserted?.id,
    metadata: { prNumber: params.prNumber, verdict, reason, confidence },
  });

  return { verdict, posted, reason, checkId: inserted?.id };
}
