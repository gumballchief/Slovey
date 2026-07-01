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
  const git = octokit.rest.git;

  const baseRef = await git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
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
  await git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: commit.data.sha });
  return commit.data.sha;
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
