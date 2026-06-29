import { afterEach, describe, expect, it } from "vitest";
import { getAI, setAI } from "../src/ai";
import { judgePrompt, type JudgePrInput } from "../src/ai/prompts";
import type { AICompleteOptions, AIProvider, JudgeResult } from "../src/ai/types";
import { guardWarning, type CitableDecision } from "../src/guardrails";
import { buildComment } from "../src/pipelines/comment";

// A fake judge that READS the prompt (so this exercises judgePrompt → provider →
// JudgeResult → guardrail → comment as one slice) and returns a scripted verdict.
class FakeJudge implements AIProvider {
  readonly name = "fake";
  constructor(private readonly script: (prompt: string) => JudgeResult) {}
  async complete(prompt: string): Promise<string> {
    return JSON.stringify(this.script(prompt));
  }
  async completeJSON<T>(prompt: string, _opts?: AICompleteOptions): Promise<T | null> {
    return this.script(prompt) as T;
  }
}

function script(prompt: string): JudgeResult {
  // Scope detection to the PR's changed files (the decisions list also mentions
  // fly.toml in its examples, so we must not match on the whole prompt).
  const i = prompt.indexOf("CHANGED FILES:");
  const changed = i >= 0 ? prompt.slice(i) : "";
  // The model "warns" but cites a PR that isn't in the candidate set.
  if (changed.includes("ghost.yml"))
    return { warn: true, confidence: "high", evidence: "PR #99999", explanation: "bogus citation" };
  // A real conflict but the model is only low-confidence about it.
  if (changed.includes("lowconf.toml"))
    return { warn: true, confidence: "low", evidence: "PR #29636", explanation: "maybe a deploy config" };
  // A real, confident, citable conflict — should post a rich comment.
  if (changed.includes("fly.toml"))
    return {
      warn: true,
      confidence: "high",
      evidence: "PR #29636",
      explanation: "Adds a fly.toml platform deploy config",
      severity: "high",
      suggestedFix: "Remove fly.toml; deploys are managed centrally.",
    };
  return { warn: false, confidence: "high", evidence: "", explanation: "no conflict" };
}

const DECISIONS = [
  {
    id: "d1",
    decision: "No platform deploy configs (fly.toml, vercel.json) live in the repo.",
    examples: ["fly.toml", "vercel.json"],
    evidence: ["PR #29636"],
  },
  { id: "d2", decision: "Payments are handled internally.", examples: [], evidence: ["PR #29296"] },
];

const citable: CitableDecision[] = DECISIONS.map((d) => ({
  id: d.id,
  decision: d.decision,
  evidence: d.evidence,
}));

/** Run the real judge→guard→comment slice for a PR against a confidence floor. */
async function decide(pr: JudgePrInput, threshold: "low" | "high" | "strict") {
  const result = (await getAI().completeJSON<JudgeResult>(
    judgePrompt(DECISIONS, pr),
    { tier: "premium" },
  ))!;
  const guard = guardWarning(result, citable, threshold);
  const comment =
    guard.post && guard.matched
      ? buildComment({
          explanation: result.explanation,
          decision: guard.matched.decision,
          citation: result.evidence,
          confidence: result.confidence,
          severity: result.severity,
          suggestedFix: result.suggestedFix,
        })
      : null;
  return { result, guard, comment };
}

afterEach(() => setAI(null));

describe("check pipeline (judge → guardrail → comment)", () => {
  it("posts a cited, severity-tagged comment for a confident, resolvable conflict", async () => {
    setAI(new FakeJudge(script));
    const { guard, comment } = await decide(
      { title: "Add Fly deploy", body: "", changedFiles: ["fly.toml"] },
      "high",
    );
    expect(guard.post).toBe(true);
    expect(guard.matched?.id).toBe("d1");
    expect(comment).toContain("PR #29636");
    expect(comment).toContain("No platform deploy configs");
    expect(comment).toContain("🔴 High");
    expect(comment).toContain("Suggested fix:");
    expect(comment).toContain("<!-- company-brain -->");
  });

  it("stays silent when the model warns but cites a decision that doesn't exist", async () => {
    setAI(new FakeJudge(script));
    const { guard, comment } = await decide(
      { title: "Add ghost config", body: "", changedFiles: ["ghost.yml"] },
      "high",
    );
    expect(guard.post).toBe(false);
    expect(guard.reason).toBe("no-resolvable-citation");
    expect(comment).toBeNull();
  });

  it("suppresses warnings below the confidence floor", async () => {
    setAI(new FakeJudge(script));
    const { guard } = await decide(
      { title: "Maybe a deploy config", body: "", changedFiles: ["lowconf.toml"] },
      "high",
    );
    expect(guard.post).toBe(false);
    expect(guard.reason).toBe("below-confidence-floor");
  });

  it("posts nothing when there is no conflict", async () => {
    setAI(new FakeJudge(script));
    const { result, guard } = await decide(
      { title: "Update README", body: "", changedFiles: ["README.md"] },
      "high",
    );
    expect(result.warn).toBe(false);
    expect(guard.post).toBe(false);
    expect(guard.reason).toBe("no-conflict");
  });
});
