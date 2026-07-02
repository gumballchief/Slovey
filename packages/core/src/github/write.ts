import type { InstallationOctokit } from "./app";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface FileChange {
  path: string;
  content: string;
}

/** Read a file's current UTF-8 content at a ref, or null if it doesn't exist. */
export async function getFileContent(
  octokit: InstallationOctokit,
  { owner, repo }: RepoRef,
  path: string,
  ref?: string,
): Promise<string | null> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ...(ref ? { ref } : {}) });
    const data = res.data as { content?: string; encoding?: string };
    if (data.content && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf8");
    }
    return null; // directory, submodule, or unsupported encoding
  } catch (e) {
    if ((e as { status?: number })?.status === 404) return null;
    throw e;
  }
}

/**
 * Commit a set of files as a SINGLE commit on a new branch off `baseBranch`,
 * via the Git Data API. Returns the new commit SHA.
 */
export async function commitFilesToNewBranch(
  octokit: InstallationOctokit,
  opts: {
    owner: string;
    repo: string;
    baseBranch: string;
    newBranch: string;
    message: string;
    files: FileChange[];
  },
): Promise<string> {
  const { owner, repo, baseBranch, newBranch, message, files } = opts;
  const sha = await createCommitOn(octokit, { owner, repo, onBranch: baseBranch, message, files });
  await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha });
  return sha;
}

/**
 * Commit a set of files onto an EXISTING branch (used by the agent's
 * revise-until-clean loop to push a new revision to its own PR branch).
 */
export async function commitFilesToBranch(
  octokit: InstallationOctokit,
  opts: { owner: string; repo: string; branch: string; message: string; files: FileChange[] },
): Promise<string> {
  const { owner, repo, branch, message, files } = opts;
  const sha = await createCommitOn(octokit, { owner, repo, onBranch: branch, message, files });
  await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha });
  return sha;
}

async function createCommitOn(
  octokit: InstallationOctokit,
  opts: { owner: string; repo: string; onBranch: string; message: string; files: FileChange[] },
): Promise<string> {
  const { owner, repo, onBranch, message, files } = opts;
  const git = octokit.rest.git;
  const baseRef = await git.getRef({ owner, repo, ref: `heads/${onBranch}` });
  const baseSha = baseRef.data.object.sha;
  const baseCommit = await git.getCommit({ owner, repo, commit_sha: baseSha });
  const tree = await Promise.all(
    files.map(async (f) => {
      const blob = await git.createBlob({ owner, repo, content: f.content, encoding: "utf-8" });
      return { path: f.path, mode: "100644" as const, type: "blob" as const, sha: blob.data.sha };
    }),
  );
  const newTree = await git.createTree({ owner, repo, base_tree: baseCommit.data.tree.sha, tree });
  const commit = await git.createCommit({ owner, repo, message, tree: newTree.data.sha, parents: [baseSha] });
  return commit.data.sha;
}

/** CI signal for a ref: combined commit status + check runs, one poll. */
export async function getCiStatus(
  octokit: InstallationOctokit,
  opts: { owner: string; repo: string; ref: string },
): Promise<{ configured: boolean; state: string; summary: string }> {
  const { owner, repo, ref } = opts;
  const [status, checks] = await Promise.all([
    octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref }).catch(() => null),
    octokit.rest.checks.listForRef({ owner, repo, ref, per_page: 30 }).catch(() => null),
  ]);
  const runs = checks?.data.check_runs ?? [];
  const contexts = status?.data.statuses ?? [];
  if (runs.length === 0 && contexts.length === 0) {
    return { configured: false, state: "none", summary: "No CI is configured on this repository." };
  }
  const failing = [
    ...runs.filter((r) => r.conclusion && !["success", "neutral", "skipped"].includes(r.conclusion)).map((r) => r.name),
    ...contexts.filter((s) => s.state === "failure" || s.state === "error").map((s) => s.context),
  ];
  const pending = runs.filter((r) => r.status !== "completed").length + contexts.filter((s) => s.state === "pending").length;
  const state = failing.length > 0 ? "failing" : pending > 0 ? "pending" : "passing";
  const summary =
    state === "failing"
      ? `CI failing: ${failing.slice(0, 5).join(", ")}`
      : state === "pending"
        ? `CI still running (${pending} pending)`
        : "CI passing.";
  return { configured: true, state, summary };
}

/**
 * Open a pull request, preferring a DRAFT. Draft PRs aren't available on free
 * private repos, so fall back to a normal PR if the draft create fails.
 */
export async function openPullRequest(
  octokit: InstallationOctokit,
  opts: { owner: string; repo: string; head: string; base: string; title: string; body: string },
): Promise<{ number: number; url: string; draft: boolean }> {
  const { owner, repo, head, base, title, body } = opts;
  try {
    const res = await octokit.rest.pulls.create({ owner, repo, head, base, title, body, draft: true });
    return { number: res.data.number, url: res.data.html_url, draft: true };
  } catch {
    const res = await octokit.rest.pulls.create({ owner, repo, head, base, title, body, draft: false });
    return { number: res.data.number, url: res.data.html_url, draft: false };
  }
}
