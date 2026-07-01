import { getDb, repoKnowledge } from "@company-brain/db";
import { eq } from "drizzle-orm";
import { getAI } from "../ai";
import { getInstallationOctokit } from "../github";
import { commitFilesToNewBranch, getFileContent, openPullRequest } from "../github/write";
import { checkPr } from "./check";
import { retrieveDecisions, type RetrievedDecision } from "./retrieve";

export interface AgentParams {
  repoId: string;
  /** GitHub installation id (numeric). */
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  intent: string;
}

export interface AgentResult {
  branch: string;
  prNumber: number;
  prUrl: string;
  draft: boolean;
  path: string;
  isNew: boolean;
  decisionsUsed: number;
  /** Result of the agent self-reviewing its own PR (undefined if review failed). */
  verdict?: string;
  reviewPosted: boolean;
}

interface Plan {
  path: string;
  isNew: boolean;
  reason: string;
}

// Never let the agent touch CI, secrets, deps, or migrations.
const PROTECTED_PATH = /(^|\/)(\.github\/workflows|\.env|node_modules|migrations?)(\/|$)|package-lock|pnpm-lock/i;

function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[\w.-]*\n([\s\S]*?)\n```$/);
  return `${(m?.[1] ?? t).trim()}\n`;
}

/** Parse the plan JSON out of the model's reply, tolerating fences/prose. */
function parsePlan(raw: string): Plan | null {
  for (const candidate of [stripFence(raw), raw.match(/\{[\s\S]*\}/)?.[0]]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as Plan;
    } catch {
      /* try next */
    }
  }
  return null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "task";
}

function decisionsBlock(decisions: RetrievedDecision[]): string {
  if (decisions.length === 0) return "(no recorded decisions found for this area)";
  return decisions
    .map(
      (d, i) =>
        `${i + 1}. ${d.decision}${d.why ? ` — because ${d.why}` : ""}${
          d.evidence.length ? ` [${d.evidence.join(", ")}]` : ""
        }`,
    )
    .join("\n");
}

async function getArchitectureContext(repoId: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ kind: repoKnowledge.kind, data: repoKnowledge.data })
    .from(repoKnowledge)
    .where(eq(repoKnowledge.repoId, repoId));
  const arch = rows.find((r) => r.kind === "architecture")?.data as
    | { summary?: string; frameworks?: string[]; topLevelDirs?: string[]; apiRoutes?: string[] }
    | undefined;
  if (!arch) return "(no architecture index available — run index-repo first)";
  return [
    arch.summary && `Summary: ${arch.summary}`,
    arch.frameworks?.length && `Frameworks: ${arch.frameworks.join(", ")}`,
    arch.topLevelDirs?.length && `Top-level dirs: ${arch.topLevelDirs.join(", ")}`,
    arch.apiRoutes?.length && `Existing API routes (sample):\n${arch.apiRoutes.slice(0, 40).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The auto-PR agent. Given a plain-language intent, retrieve the repo's decisions
 * + architecture, plan a single target file, generate its contents (constrained by
 * those decisions), commit to a new branch, and open a draft PR. The existing
 * checkPr pipeline then reviews the PR automatically. MVP: single-file changes.
 */
export async function runAgentTask(params: AgentParams): Promise<AgentResult> {
  const { repoId, installationId, owner, name, fullName, defaultBranch, intent } = params;

  const [decisions, architecture] = await Promise.all([
    retrieveDecisions(repoId, { title: intent, body: intent }, { topK: 8 }),
    getArchitectureContext(repoId),
  ]);
  const constraints = decisionsBlock(decisions);

  // 1. PLAN — choose one file to create or modify. Uses complete() (not
  // completeJSON, which swallows provider errors into null) so a real failure —
  // e.g. "Gemini 429: quota exceeded" — surfaces verbatim in the run's error
  // instead of a misleading "no target file chosen".
  const planRaw = await getAI().complete(
    `You are a senior engineer planning a SMALL, single-file change to the repository "${fullName}".

Repository architecture:
${architecture}

Team decisions you MUST respect:
${constraints}

Task: ${intent}

Choose exactly ONE file to create or modify. Prefer creating a new, self-contained file when reasonable. Respond ONLY as JSON: {"path":"relative/path/from/repo/root","isNew":true|false,"reason":"one sentence"}`,
    { tier: "premium", maxTokens: 400 },
  );
  const plan = parsePlan(planRaw);
  if (!plan?.path) throw new Error(`agent: planning returned no usable file target (raw: ${planRaw.slice(0, 160)})`);
  if (PROTECTED_PATH.test(plan.path)) throw new Error(`agent: refusing to edit protected path: ${plan.path}`);

  const octokit = await getInstallationOctokit(installationId);
  const current = plan.isNew
    ? null
    : await getFileContent(octokit, { owner, repo: name }, plan.path, defaultBranch);

  // 2. CODE — generate the full file contents.
  const raw = await getAI().complete(
    `You are a senior engineer writing production code for "${fullName}".

Team decisions you MUST follow (violating any will fail review):
${constraints}

Repository architecture:
${architecture}

Task: ${intent}

Target file: ${plan.path}${current !== null ? `\n\nCurrent contents:\n${current}` : "\n\n(this is a new file)"}

Output the COMPLETE new contents of ${plan.path} and NOTHING else — no prose, no markdown code fences.`,
    { tier: "premium", maxTokens: 4000, temperature: 0.2 },
  );
  const contents = stripFence(raw);
  if (!contents.trim()) throw new Error("agent: code generation returned empty output");

  // 3. Branch → commit → PR.
  const branch = `agent/${slugify(intent)}-${Date.now().toString(36)}`;
  await commitFilesToNewBranch(octokit, {
    owner,
    repo: name,
    baseBranch: defaultBranch,
    newBranch: branch,
    message: `${intent}\n\nOpened by the Company Brain agent.`,
    files: [{ path: plan.path, content: contents }],
  });

  const body = [
    "**Company Brain agent** drafted this from the request:",
    `> ${intent}`,
    "",
    `**File:** \`${plan.path}\` (${plan.isNew ? "new" : "modified"}) — ${plan.reason}`,
    decisions.length ? `\n**Decisions honored:**\n${decisions.map((d) => `- ${d.decision}`).join("\n")}` : "",
    "",
    "_Review before merging — Company Brain will also auto-check this PR against memory._",
  ]
    .filter(Boolean)
    .join("\n");

  const pr = await openPullRequest(octokit, {
    owner,
    repo: name,
    head: branch,
    base: defaultBranch,
    title: intent.length > 72 ? `${intent.slice(0, 69)}...` : intent,
    body,
  });

  // 4. Self-review. GitHub does NOT deliver a webhook to the same App that
  // opened the PR, so trigger the memory check directly rather than relying on
  // the webhook. The PR is already open, so a review failure is non-fatal.
  let verdict: string | undefined;
  let reviewPosted = false;
  try {
    const review = await checkPr({
      repoId,
      installationId,
      owner,
      name,
      fullName,
      prNumber: pr.number,
      action: "opened",
    });
    verdict = review.verdict;
    reviewPosted = review.posted;
  } catch {
    /* PR is open; self-review is best-effort */
  }

  return {
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    draft: pr.draft,
    path: plan.path,
    isNew: !!plan.isNew,
    decisionsUsed: decisions.length,
    verdict,
    reviewPosted,
  };
}
