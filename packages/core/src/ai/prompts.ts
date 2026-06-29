import type { ExtractedDecision } from "./types";

/** Categories the classifier and retrieval boosting use. */
export const CATEGORIES = [
  "deploy-config",
  "payments",
  "security",
  "api-contract",
  "react-state",
  "logging",
  "docs",
  "ui-cosmetic",
  "env-config",
  "testing",
  "database",
  "architecture",
  "dependencies",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface JudgeDecisionInput {
  decision: string;
  examples: string[];
  evidence: string[]; // citations, e.g. ["PR #29499"]
}

export interface JudgePrInput {
  title: string;
  body: string;
  changedFiles?: string[];
  diffSummary?: string;
}

/**
 * The judge prompt — ported from the prototype's pr-check.mjs and extended with
 * changed-file/diff context (from smarter retrieval) and optional negative
 * examples from team dismissals. Output shape is unchanged:
 *   {"warn":bool,"evidence":"...","explanation":"one sentence","confidence":"high|medium|low"}
 */
export function judgePrompt(
  decisions: JudgeDecisionInput[],
  pr: JudgePrInput,
  dismissedNotes: string[] = [],
): string {
  const brainText = decisions
    .map(
      (d) =>
        `- ${d.decision} | covers: ${d.examples.join(", ")} | evidence: ${d.evidence.join(", ")}`,
    )
    .join("\n");

  const files = pr.changedFiles?.length
    ? `\nCHANGED FILES:\n${pr.changedFiles.slice(0, 50).join("\n")}`
    : "";
  const diff = pr.diffSummary ? `\nDIFF SUMMARY:\n${pr.diffSummary}` : "";
  const dismissed = dismissedNotes.length
    ? `\n\nThe team has reviewed and indicated these are NOT concerns — do not warn about them:\n${dismissedNotes.map((n) => `- ${n}`).join("\n")}`
    : "";

  return `Team decisions:
${brainText}

NEW pull request:
TITLE: ${pr.title}
DESCRIPTION: ${pr.body || ""}${files}${diff}${dismissed}

Does it clearly conflict with one of the team decisions above? Only warn on a clear conflict.
The "evidence" field MUST be the exact citation (e.g. "PR #29499") of the single decision it conflicts with, copied verbatim from that decision's evidence. If nothing clearly conflicts, set warn=false.
When warn=true, also set:
- "severity": one of "low" | "medium" | "high" | "critical" (how risky merging this would be given the decision).
- "suggestedFix": one concrete sentence on how to bring the PR in line with the decision.
Respond ONLY with JSON: {"warn":true/false,"evidence":"...","explanation":"one sentence","confidence":"high/medium/low","severity":"low/medium/high/critical","suggestedFix":"..."}`;
}

/**
 * Extraction prompt — pulls durable decisions from a batch of closed PRs and
 * their discussion. Every decision MUST carry evidence (PR numbers); the
 * pipeline drops any with empty evidence.
 */
export function extractPrompt(prBatchText: string): string {
  return `You are building an engineering team's decision memory from their closed pull requests (both MERGED and REJECTED) and the discussion on them.

Extract durable, reusable team decisions — rules, rejected approaches, conventions, and architectural choices that should guide future PRs. Ignore one-off details.

For each decision provide:
- "decision": the durable rule, stated generally (not tied to one file)
- "why": the reason, drawn from the discussion (may be "")
- "examples": concrete examples or rejected approaches (array of short strings)
- "evidence": the PR citations this came from, formatted exactly like ["PR #29499", "PR #10803"] (array; REQUIRED, never empty)
- "category": one of ${CATEGORIES.join(", ")}

Rules:
- Ground every decision in the provided PRs. Never invent a decision.
- A REJECTED PR is strong signal of a rejected approach.
- Prefer fewer, high-quality, general decisions over many narrow ones.
- If a PR yields no durable decision, skip it.

PULL REQUESTS:
${prBatchText}

Respond ONLY with a JSON array of decision objects.`;
}

/**
 * Consolidation prompt — merges semantically-equivalent decisions into one,
 * unioning their examples and evidence.
 */
export function consolidatePrompt(decisions: ExtractedDecision[]): string {
  return `Below is a list of extracted team decisions. Some are duplicates or near-duplicates phrased differently.

Merge semantically-equivalent decisions into a single, clearly-worded decision. When merging, UNION their "examples" and "evidence" arrays (keep all citations). Keep distinct decisions separate. Never drop evidence.

DECISIONS:
${JSON.stringify(decisions, null, 2)}

Respond ONLY with a JSON array of the consolidated decision objects, same shape ({decision, why, examples, evidence, category}).`;
}

/** Categorize an incoming PR into one of the fixed categories. */
export function categorizePrompt(pr: JudgePrInput): string {
  return `Classify this pull request into exactly one category from: ${CATEGORIES.join(", ")}.

TITLE: ${pr.title}
DESCRIPTION: ${pr.body || ""}
${pr.changedFiles?.length ? `CHANGED FILES:\n${pr.changedFiles.slice(0, 30).join("\n")}` : ""}

Respond ONLY with JSON: {"category":"<one of the categories>"}`;
}
