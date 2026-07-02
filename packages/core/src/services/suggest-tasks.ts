import { architectureCheckContents, rulesFromRejectedDecisions } from "../preflight/architecture";
import { fetchRejectedDecisions } from "../preflight/decisions";
import { getInstallationOctokit } from "../github";
import type { ResolvedRepo } from "./sync";

export interface SuggestedTask {
  /** Ready-to-run agent intent. */
  intent: string;
  reason: string;
  files: string[];
}

const SOURCE_FILE = /\.(t|j)sx?$/;
const SKIP_PATH = /(^|\/)(node_modules|\.next|dist|build|coverage|__tests__|tests?)\/|\.((test|spec)\.[cm]?[jt]sx?|d\.ts)$/;
const MAX_FILES = 40;
const MAX_BLOB_BYTES = 120_000;

/**
 * Proactive mode: mine the repo for places where a REJECTED decision's pattern
 * still lives in the code, and turn each into a ready-to-run agent task
 * ("this pattern was rejected — remove it from these files"). Deterministic
 * (derived rules, no LLM) so it's cheap enough to compute on demand.
 */
export async function suggestTasks(repo: ResolvedRepo): Promise<SuggestedTask[]> {
  const rejected = await fetchRejectedDecisions(repo.repoId);
  const rules = rulesFromRejectedDecisions(rejected);
  if (rules.length === 0) return [];

  const octokit = await getInstallationOctokit(repo.installationGithubId);
  const tree = await octokit.rest.git.getTree({
    owner: repo.owner,
    repo: repo.name,
    tree_sha: repo.defaultBranch,
    recursive: "1",
  });
  const candidates = (tree.data.tree ?? [])
    .filter((n) => n.type === "blob" && n.path && SOURCE_FILE.test(n.path) && !SKIP_PATH.test(n.path))
    .filter((n) => (n.size ?? 0) <= MAX_BLOB_BYTES)
    // Shallow paths first — src/app code beats deeply nested vendored files.
    .sort((a, b) => a.path!.split("/").length - b.path!.split("/").length)
    .slice(0, MAX_FILES);

  const files: { path: string; content: string }[] = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = await Promise.all(
      candidates.slice(i, i + BATCH).map(async (n) => {
        try {
          const blob = await octokit.rest.git.getBlob({ owner: repo.owner, repo: repo.name, file_sha: n.sha! });
          return { path: n.path!, content: Buffer.from(blob.data.content, "base64").toString("utf8") };
        } catch {
          return null;
        }
      }),
    );
    for (const f of batch) if (f) files.push(f);
  }

  const check = architectureCheckContents(files, files.map((f) => f.path), rules);
  if (check.errors.length === 0) return [];

  // Group hits by rule reason → one suggested task per rejected pattern.
  const byReason = new Map<string, Set<string>>();
  for (const e of check.errors) {
    const reason = e.message.replace(/^Forbidden (pattern|import "[^"]*"): /, "");
    if (!byReason.has(reason)) byReason.set(reason, new Set());
    byReason.get(reason)!.add(e.file);
  }

  return [...byReason.entries()].map(([reason, fileSet]) => {
    const list = [...fileSet];
    return {
      intent: `Remove the rejected pattern from ${list.length === 1 ? list[0] : `${list.length} files (${list.slice(0, 3).join(", ")}${list.length > 3 ? ", …" : ""})`} — ${reason.slice(0, 160)}`,
      reason,
      files: list,
    };
  });
}
