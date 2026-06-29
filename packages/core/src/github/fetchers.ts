import type { InstallationOctokit } from "./app";

const BODY_CAP = 1200;
const DISCUSSION_CAP = 2500;
const DIFF_SUMMARY_CAP = 3000;

function truncate(s: string, cap: number): string {
  if (!s) return "";
  return s.length > cap ? `${s.slice(0, cap)}\n…[truncated]` : s;
}

export interface ClosedPr {
  number: number;
  title: string;
  body: string;
  merged: boolean;
  state: "merged" | "rejected";
  discussion: string;
}

/**
 * Fetch closed PRs (both MERGED and REJECTED) with their discussion threads —
 * issue comments, review comments, and review summaries (the "why"). Ported from
 * the prototype's refresh-memory behavior, with truncation to keep prompts small.
 */
export async function fetchClosedPRs(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  opts: { limit?: number } = {},
): Promise<ClosedPr[]> {
  const limit = opts.limit ?? 60;
  const list = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: Math.min(limit, 100),
  });

  const out: ClosedPr[] = [];
  for (const pr of list.data.slice(0, limit)) {
    const merged = Boolean(pr.merged_at);
    const parts: string[] = [];

    try {
      const [issueComments, reviewComments, reviews] = await Promise.all([
        octokit.rest.issues.listComments({ owner, repo, issue_number: pr.number, per_page: 30 }),
        octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: pr.number, per_page: 30 }),
        octokit.rest.pulls.listReviews({ owner, repo, pull_number: pr.number, per_page: 30 }),
      ]);
      for (const c of issueComments.data) if (c.body) parts.push(`comment: ${c.body}`);
      for (const c of reviewComments.data) if (c.body) parts.push(`review-comment: ${c.body}`);
      for (const r of reviews.data) if (r.body) parts.push(`review(${r.state}): ${r.body}`);
    } catch {
      // discussion is best-effort
    }

    out.push({
      number: pr.number,
      title: pr.title,
      body: truncate(pr.body ?? "", BODY_CAP),
      merged,
      state: merged ? "merged" : "rejected",
      discussion: truncate(parts.join("\n"), DISCUSSION_CAP),
    });
  }
  return out;
}

/** Format closed PRs into the text block the extraction prompt consumes. */
export function buildPrBatchText(prs: ClosedPr[]): string {
  return prs
    .map(
      (pr) =>
        `### PR #${pr.number} [${pr.state.toUpperCase()}]\nTITLE: ${pr.title}\nDESCRIPTION: ${pr.body}\nDISCUSSION:\n${pr.discussion || "(none)"}`,
    )
    .join("\n\n");
}

export interface DocFile {
  path: string;
  type: "adr" | "readme" | "contributing" | "docs";
  sha: string;
  content: string;
}

function classifyDoc(path: string): DocFile["type"] | null {
  const p = path.toLowerCase();
  if (p.includes("adr") || /\/\d{3,4}-/.test(p)) return "adr";
  if (p.endsWith("readme.md")) return "readme";
  if (p.endsWith("contributing.md")) return "contributing";
  if (p.startsWith("docs/") || p.includes("/docs/")) return "docs";
  return null;
}

/** Layer-2 docs: ADRs/README/CONTRIBUTING/docs, via the git tree. */
export async function fetchDocs(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  defaultBranch: string,
  opts: { maxFiles?: number } = {},
): Promise<DocFile[]> {
  const maxFiles = opts.maxFiles ?? 40;
  const tree = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: "1",
  });
  const candidates = tree.data.tree
    .filter((n) => n.type === "blob" && n.path && classifyDoc(n.path))
    .slice(0, maxFiles);

  const docs: DocFile[] = [];
  for (const node of candidates) {
    if (!node.path || !node.sha) continue;
    const type = classifyDoc(node.path)!;
    try {
      const blob = await octokit.rest.git.getBlob({ owner, repo, file_sha: node.sha });
      const content = Buffer.from(blob.data.content, "base64").toString("utf8");
      docs.push({ path: node.path, type, sha: node.sha, content: truncate(content, 6000) });
    } catch {
      /* skip unreadable */
    }
  }
  return docs;
}

export interface PrForCheck {
  number: number;
  title: string;
  body: string;
  author: string;
  headSha: string;
  changedFiles: string[];
  diffSummary: string;
}

/** Fetch a single PR with the context the judge needs. */
export async function fetchPrForCheck(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrForCheck> {
  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  const changedFiles = files.data.map((f) => f.filename);
  const diffSummary = truncate(
    files.data
      .map((f) => `${f.filename} (+${f.additions}/-${f.deletions})\n${f.patch ?? ""}`)
      .join("\n\n"),
    DIFF_SUMMARY_CAP,
  );
  return {
    number: prNumber,
    title: pr.data.title,
    body: truncate(pr.data.body ?? "", BODY_CAP),
    author: pr.data.user?.login ?? "unknown",
    headSha: pr.data.head.sha,
    changedFiles,
    diffSummary,
  };
}

/** Find an existing Company Brain comment on a PR (to avoid double-posting). */
export async function findBotComment(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  prNumber: number,
  marker: string,
): Promise<number | null> {
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const found = comments.data.find((c) => c.body?.includes(marker));
  return found?.id ?? null;
}

/** Post a new comment or update the existing one. Returns the comment id. */
export async function postOrUpdateComment(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  existingCommentId: number | null,
): Promise<number> {
  if (existingCommentId) {
    const r = await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingCommentId,
      body,
    });
    return r.data.id;
  }
  const r = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
  return r.data.id;
}
