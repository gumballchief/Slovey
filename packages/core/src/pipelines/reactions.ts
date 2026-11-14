import { feedback, getDb, prChecks } from "@company-brain/db";
import { and, desc, eq } from "drizzle-orm";
import { getInstallationOctokit } from "../github/app";
import { findBotComment } from "../github/fetchers";
import { logger } from "../logger";
import { COMMENT_MARKER } from "./comment";
import { recordFeedback } from "./feedback";

const log = logger.child({ component: "reactions" });

interface ReactionLike {
  content?: string;
  created_at?: string;
  author_association?: string;
  user?: { login?: string; type?: string } | null;
}

const TRUSTED_ASSOCIATIONS = new Set(["COLLABORATOR", "MEMBER", "OWNER"]);

/**
 * Pure: the distinct non-bot users who reacted 👎 (content "-1"). Extracted so it
 * can be unit-tested without GitHub.
 */
export function pickDownvoters(reactions: ReactionLike[]): string[] {
  const out = new Set<string>();
  for (const r of reactions) {
    if (r.content !== "-1") continue;
    const u = r.user;
    if (!u?.login || u.type === "Bot" || u.login.endsWith("[bot]")) continue;
    if (
      r.author_association !== undefined &&
      !TRUSTED_ASSOCIATIONS.has(r.author_association)
    )
      continue;
    out.add(u.login);
  }
  return [...out];
}

/**
 * Pure: like pickDownvoters but drops reactions created at-or-before the check.
 * Prevents a stale 👎 from being re-recorded as a dismissal for a later check
 * the reactor never saw. A missing/unparseable timestamp is treated as stale.
 */
export function pickFreshDownvoters(
  reactions: ReactionLike[],
  checkedAt: Date | string | number,
): string[] {
  const checkedMs = new Date(checkedAt).getTime();
  if (Number.isNaN(checkedMs)) return pickDownvoters(reactions);
  const out = new Set<string>();
  for (const r of reactions) {
    if (r.content !== "-1") continue;
    const u = r.user;
    if (!u?.login || u.type === "Bot" || u.login.endsWith("[bot]")) continue;
    if (
      r.author_association !== undefined &&
      !TRUSTED_ASSOCIATIONS.has(r.author_association)
    )
      continue;
    if (!r.created_at) continue;
    const reactedMs = new Date(r.created_at).getTime();
    if (Number.isNaN(reactedMs) || reactedMs <= checkedMs) continue;
    out.add(u.login);
  }
  return [...out];
}

/**
 * Record a 👎 on the bot's PR comment as a dismissal. GitHub has no
 * comment-reaction webhook, so this is polled during the periodic rescan.
 * Deduped per (check, user) so repeated sweeps don't spam the feedback table.
 */
export async function pollReactionDismissals(params: {
  repoId: string;
  installationId: number;
  owner: string;
  name: string;
  prNumber: number;
}): Promise<{ recorded: number }> {
  const octokit = await getInstallationOctokit(params.installationId);
  const commentId = await findBotComment(
    octokit,
    params.owner,
    params.name,
    params.prNumber,
    COMMENT_MARKER,
  );
  if (!commentId) return { recorded: 0 };

  const res = await octokit.rest.reactions.listForIssueComment({
    owner: params.owner,
    repo: params.name,
    comment_id: commentId,
    per_page: 100,
  });
  const db = getDb();
  const [check] = await db
    .select({
      id: prChecks.id,
      matched: prChecks.matchedDecisionId,
      checkedAt: prChecks.checkedAt,
    })
    .from(prChecks)
    .where(and(eq(prChecks.repoId, params.repoId), eq(prChecks.prNumber, params.prNumber)))
    .orderBy(desc(prChecks.checkedAt))
    .limit(1);
  if (!check) return { recorded: 0 };

  const downvoters = pickFreshDownvoters(res.data as ReactionLike[], check.checkedAt);
  if (downvoters.length === 0) return { recorded: 0 };

  let recorded = 0;
  let prAuthor: string | null = null;
  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner: params.owner,
      repo: params.name,
      pull_number: params.prNumber,
    });
    prAuthor = pr.user?.login ?? null;
  } catch (err) {
    log.warn("failed to fetch PR author; skipping reaction dismissals", {
      repo: `${params.owner}/${params.name}`,
      pr: params.prNumber,
      error: err instanceof Error ? err.message : String(err),
    });
    return { recorded: 0 };
  }
  for (const user of downvoters) {
    if (prAuthor && user.toLowerCase() === prAuthor.toLowerCase()) continue;
    try {
      const { data: perm } =
        await octokit.rest.repos.getCollaboratorPermissionLevel({
          owner: params.owner,
          repo: params.name,
          username: user,
        });
      const level = (perm as { permission?: string } | null)?.permission;
      if (level !== "admin" && level !== "maintain" && level !== "write")
        continue;
    } catch {
      continue;
    }
    const existing = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(
        and(
          eq(feedback.prCheckId, check.id),
          eq(feedback.byUser, user),
          eq(feedback.action, "dismiss"),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;
    await recordFeedback({
      repoId: params.repoId,
      prCheckId: check.id,
      decisionId: check.matched ?? undefined,
      action: "dismiss",
      byUser: user,
      reason: `👎 reaction on the Company Brain comment (PR #${params.prNumber})`,
    });
    recorded++;
  }
  if (recorded > 0) {
    log.info("reaction dismissals recorded", {
      repo: `${params.owner}/${params.name}`,
      pr: params.prNumber,
      recorded,
    });
  }
  return { recorded };
}
