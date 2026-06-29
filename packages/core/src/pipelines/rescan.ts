import { loadEnv } from "@company-brain/config";
import { getInstallationOctokit } from "../github/app";
import { logger } from "../logger";
import { enqueue, JOBS } from "../queue";
import { listAllRepos, resolveRepoById, type ResolvedRepo } from "../services/sync";
import { pollReactionDismissals } from "./reactions";

const log = logger.child({ component: "rescan" });

/** Honor the dev allowlist so periodic sweeps never touch unrelated repos. */
function inScope(fullName: string): boolean {
  const allow = loadEnv().ALLOWLIST_REPOS;
  if (allow.length === 0) return true;
  return allow.includes(fullName.toLowerCase());
}

async function targets(repoId?: string): Promise<ResolvedRepo[]> {
  if (repoId) {
    const r = await resolveRepoById(repoId);
    return r ? [r] : [];
  }
  return listAllRepos();
}

export interface RescanResult {
  repos: number;
  prsQueued: number;
  /** 👎 reactions folded into dismissals during the sweep. */
  dismissals: number;
}

/**
 * Re-check every open PR across active repos (or one repo). Decisions and
 * dismissals evolve between pushes, so a periodic sweep keeps warnings current
 * without waiting for a new commit. Reuses the existing check_pr job + guards.
 */
export async function runRescanPrs(repoId?: string): Promise<RescanResult> {
  const repos = await targets(repoId);
  let prsQueued = 0;
  let scanned = 0;
  let dismissals = 0;

  for (const repo of repos) {
    if (!inScope(repo.fullName)) continue;
    scanned++;
    try {
      const octokit = await getInstallationOctokit(repo.installationGithubId);
      const open = await octokit.paginate(octokit.rest.pulls.list, {
        owner: repo.owner,
        repo: repo.name,
        state: "open",
        per_page: 100,
      });
      for (const pr of open) {
        await enqueue(JOBS.checkPr, {
          installationId: repo.installationGithubId,
          fullName: repo.fullName,
          prNumber: pr.number,
          action: "manual",
        });
        prsQueued++;
        // GitHub has no comment-reaction webhook, so fold any 👎 on our comment
        // into dismissals here (best-effort; never blocks the rescan).
        try {
          const r = await pollReactionDismissals({
            repoId: repo.repoId,
            installationId: repo.installationGithubId,
            owner: repo.owner,
            name: repo.name,
            prNumber: pr.number,
          });
          dismissals += r.recorded;
        } catch (e) {
          log.warn("reaction poll failed", { repo: repo.fullName, pr: pr.number, err: e });
        }
      }
      log.info("rescan queued", { repo: repo.fullName, prs: open.length });
    } catch (e) {
      log.warn("rescan failed", { repo: repo.fullName, err: e });
    }
  }
  return { repos: scanned, prsQueued, dismissals };
}

export interface RefreshResult {
  repos: number;
}

/**
 * Re-extract + consolidate each repo's memory on a slow cadence so newly merged
 * history is folded in even if no PR is currently open. Reuses the extract job.
 */
export async function runRefreshMemory(repoId?: string): Promise<RefreshResult> {
  const repos = await targets(repoId);
  let scanned = 0;
  for (const repo of repos) {
    if (!inScope(repo.fullName)) continue;
    scanned++;
    await enqueue(JOBS.extract, {
      installationId: repo.installationGithubId,
      fullName: repo.fullName,
    });
    log.info("refresh queued", { repo: repo.fullName });
  }
  return { repos: scanned };
}
