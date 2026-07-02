import { getDb, prChecks, repoKnowledge } from "@company-brain/db";
import { eq } from "drizzle-orm";
import { getAI } from "../ai";
import { getInstallationOctokit } from "../github";
import {
  commitFilesToBranch,
  commitFilesToNewBranch,
  getCiStatus,
  getFileContent,
  openPullRequest,
  type FileChange,
} from "../github/write";
import { checkGeneratedFile } from "../preflight/generated";
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
  /** Every file the change touches. */
  files: { path: string; isNew: boolean }[];
  /** First file, kept for existing consumers (DB columns, CLI). */
  path: string;
  isNew: boolean;
  decisionsUsed: number;
  /** Final self-review verdict after any revise rounds (undefined if review failed). */
  verdict?: string;
  reviewPosted: boolean;
  /** Preflight blocked the first draft and the agent revised it before opening the PR. */
  preflightRevised: boolean;
  /** Post-PR revise-until-clean rounds performed (0 = clean on first review). */
  reviseRounds: number;
  ciState: string;
  ciSummary: string;
}

interface PlanFile {
  path: string;
  isNew: boolean;
  reason: string;
}

const MAX_FILES = 3;
const MAX_REVISE_ROUNDS = 2;

// Never let the agent touch CI, secrets, deps, or migrations.
const PROTECTED_PATH = /(^|\/)(\.github\/workflows|\.env|node_modules|migrations?)(\/|$)|package-lock|pnpm-lock/i;

function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[\w.-]*\n([\s\S]*?)\n```$/);
  return `${(m?.[1] ?? t).trim()}\n`;
}

/** Parse the plan out of the model's reply — {files:[…]} or the legacy single-file shape. */
export function parsePlanFiles(raw: string): PlanFile[] | null {
  for (const candidate of [stripFence(raw), raw.match(/\{[\s\S]*\}/)?.[0]]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { files?: PlanFile[]; path?: string; isNew?: boolean; reason?: string };
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed.files.filter((f) => f?.path).slice(0, MAX_FILES);
      }
      if (parsed.path) return [{ path: parsed.path, isNew: !!parsed.isNew, reason: parsed.reason ?? "" }];
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

function otherFilesBlock(files: FileChange[], except: string): string {
  const others = files.filter((f) => f.path !== except);
  if (others.length === 0) return "";
  return `\n\nOther files in this same change (keep imports/exports consistent with them):\n${others
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 3000)}`)
    .join("\n")}`;
}

/**
 * The auto-PR agent, Phase 2. Given a plain-language intent: retrieve decisions
 * + architecture → plan 1–3 files → generate each (memory-constrained, coherent
 * with its siblings) → Preflight-gate the generated contents (revise once if
 * blocked) → branch + draft PR → self-review via checkPr → if the review finds a
 * conflict, revise the branch until clean (bounded) → read the repo's CI signal.
 */
export async function runAgentTask(params: AgentParams): Promise<AgentResult> {
  const { repoId, installationId, owner, name, fullName, defaultBranch, intent } = params;

  const [decisions, architecture] = await Promise.all([
    retrieveDecisions(repoId, { title: intent, body: intent }, { topK: 8 }),
    getArchitectureContext(repoId),
  ]);
  const constraints = decisionsBlock(decisions);

  // 1. PLAN — 1..3 files. Uses complete() (not completeJSON, which swallows
  // provider errors into null) so real failures surface verbatim.
  const planRaw = await getAI().complete(
    `You are a senior engineer planning a SMALL, focused change to the repository "${fullName}".

Repository architecture:
${architecture}

Team decisions you MUST respect:
${constraints}

Task: ${intent}

Choose the SMALLEST set of files (1 to ${MAX_FILES}) to create or modify. Prefer one file when possible. Respond ONLY as JSON: {"files":[{"path":"relative/path","isNew":true|false,"reason":"one sentence"}]}`,
    { tier: "premium", maxTokens: 700 },
  );
  const plan = parsePlanFiles(planRaw);
  if (!plan || plan.length === 0) {
    throw new Error(`agent: planning returned no usable file targets (raw: ${planRaw.slice(0, 160)})`);
  }
  for (const f of plan) {
    if (PROTECTED_PATH.test(f.path)) throw new Error(`agent: refusing to edit protected path: ${f.path}`);
  }

  const octokit = await getInstallationOctokit(installationId);
  const currentContents = new Map<string, string | null>();
  for (const f of plan) {
    currentContents.set(f.path, f.isNew ? null : await getFileContent(octokit, { owner, repo: name }, f.path, defaultBranch));
  }

  // 2. CODE — generate each file, feeding the siblings for coherence.
  const generate = async (target: PlanFile, generated: FileChange[], feedback?: string): Promise<string> => {
    const current = currentContents.get(target.path) ?? null;
    const raw = await getAI().complete(
      `You are a senior engineer writing production code for "${fullName}".

Team decisions you MUST follow (violating any will fail review):
${constraints}

Repository architecture:
${architecture}

Task: ${intent}

Target file: ${target.path} — ${target.reason}${current !== null ? `\n\nCurrent contents:\n${current}` : "\n\n(this is a new file)"}${otherFilesBlock(generated, target.path)}${feedback ? `\n\nYour previous draft was rejected. You MUST resolve every one of these problems:\n${feedback}` : ""}

Output the COMPLETE new contents of ${target.path} and NOTHING else — no prose, no markdown code fences.`,
      { tier: "premium", maxTokens: 4000, temperature: 0.2 },
    );
    const contents = stripFence(raw);
    if (!contents.trim()) throw new Error(`agent: code generation returned empty output for ${target.path}`);
    return contents;
  };

  let files: FileChange[] = [];
  for (const f of plan) files.push({ path: f.path, content: await generate(f, files) });

  // 2.5 PREFLIGHT every generated file BEFORE the PR exists. One revise pass
  // scoped to the failing files; still blocked after that → fail the run rather
  // than open a PR that reintroduces something the team rejected.
  const gateAll = async (fs: FileChange[]) => {
    const problems = new Map<string, string[]>();
    for (const f of fs) {
      const g = await checkGeneratedFile(repoId, f.path, f.content);
      if (g.blocked) problems.set(f.path, g.problems);
    }
    return problems;
  };
  let preflightRevised = false;
  let blockedFiles = await gateAll(files);
  if (blockedFiles.size > 0) {
    preflightRevised = true;
    for (const [path, problems] of blockedFiles) {
      const target = plan.find((f) => f.path === path)!;
      const idx = files.findIndex((f) => f.path === path);
      files[idx] = { path, content: await generate(target, files, problems.map((p) => `- ${p}`).join("\n")) };
    }
    blockedFiles = await gateAll(files);
    if (blockedFiles.size > 0) {
      const first = [...blockedFiles.values()][0]!;
      throw new Error(`agent: generated code failed Preflight after one revision — ${first.slice(0, 3).join(" | ")}`);
    }
  }

  // 3. Branch → commit → draft PR.
  const branch = `agent/${slugify(intent)}-${Date.now().toString(36)}`;
  await commitFilesToNewBranch(octokit, {
    owner,
    repo: name,
    baseBranch: defaultBranch,
    newBranch: branch,
    message: `${intent}\n\nOpened by the Company Brain agent.`,
    files,
  });

  const filesBlock = plan
    .map((f) => `- \`${f.path}\` (${f.isNew ? "new" : "modified"}) — ${f.reason}`)
    .join("\n");
  const body = [
    "**Company Brain agent** drafted this from the request:",
    `> ${intent}`,
    "",
    `**Files:**\n${filesBlock}`,
    decisions.length ? `\n**Decisions honored:**\n${decisions.map((d) => `- ${d.decision}`).join("\n")}` : "",
    preflightRevised ? "\n_Preflight blocked the first draft; this is the revised version that passes the knowledge checks._" : "",
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

  // 4. Self-review + revise-until-clean. GitHub doesn't deliver webhooks to the
  // acting App, so run checkPr directly. On a conflict verdict, feed the
  // reviewer's own explanation back into codegen, push a revision to the branch,
  // and re-review — bounded so a stubborn conflict ends with the honest verdict.
  let verdict: string | undefined;
  let reviewPosted = false;
  let reviseRounds = 0;
  try {
    let review = await checkPr({ repoId, installationId, owner, name, fullName, prNumber: pr.number, action: "opened" });
    verdict = review.verdict;
    reviewPosted = review.posted;
    while (review.verdict === "conflict" && reviseRounds < MAX_REVISE_ROUNDS) {
      const feedback = await getReviewFeedback(review.checkId);
      if (!feedback) break;
      reviseRounds += 1;
      for (let i = 0; i < files.length; i++) {
        const target = plan.find((f) => f.path === files[i]!.path)!;
        files[i] = { path: files[i]!.path, content: await generate(target, files, feedback) };
      }
      const stillBlocked = await gateAll(files);
      if (stillBlocked.size > 0) break; // don't push a revision that fails the knowledge gate
      await commitFilesToBranch(octokit, {
        owner,
        repo: name,
        branch,
        message: `Revise per Company Brain review (round ${reviseRounds})\n\n${feedback.slice(0, 400)}`,
        files,
      });
      review = await checkPr({ repoId, installationId, owner, name, fullName, prNumber: pr.number, action: "synchronize" });
      verdict = review.verdict;
      reviewPosted = review.posted || reviewPosted;
    }
  } catch {
    /* PR is open; self-review is best-effort */
  }

  // 5. CI signal (single poll after a short settle; repos without CI report so).
  let ciState = "unknown";
  let ciSummary = "CI status unavailable.";
  try {
    await new Promise((r) => setTimeout(r, 15_000));
    const ci = await getCiStatus(octokit, { owner, repo: name, ref: branch });
    ciState = ci.state;
    ciSummary = ci.summary;
  } catch {
    /* best-effort */
  }

  return {
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    draft: pr.draft,
    files: plan.map((f) => ({ path: f.path, isNew: !!f.isNew })),
    path: plan[0]!.path,
    isNew: !!plan[0]!.isNew,
    decisionsUsed: decisions.length,
    verdict,
    reviewPosted,
    preflightRevised,
    reviseRounds,
    ciState,
    ciSummary,
  };
}

/** The reviewer's own words for the revise prompt (explanation + suggested fix). */
async function getReviewFeedback(checkId: string | null | undefined): Promise<string | null> {
  if (!checkId) return null;
  const db = getDb();
  const [row] = await db
    .select({ explanation: prChecks.explanation, suggestedFix: prChecks.suggestedFix })
    .from(prChecks)
    .where(eq(prChecks.id, checkId))
    .limit(1);
  if (!row?.explanation) return null;
  return `${row.explanation}${row.suggestedFix ? `\nSuggested fix: ${row.suggestedFix}` : ""}`;
}
