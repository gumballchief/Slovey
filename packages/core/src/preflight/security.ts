import { getAI } from "../ai";
import { fingerprint } from "./parse";
import type { RawCheck } from "./checks";
import type { PreflightError } from "./types";

interface RawFinding {
  file?: string;
  line?: number;
  issue: string;
  severity?: "critical" | "high" | "medium" | "low";
  confidence?: number;
}

/**
 * The Security Agent's AI pass: reviews the diff for security issues the
 * pattern-based secret scan can't see — injection, missing authz, unsafe
 * eval/exec, SSRF, path traversal, weak crypto, trusting client input.
 * AI unavailable → skipped with a reason (the deterministic secret-scan still
 * ran); low-confidence findings are dropped rather than nagging the agent.
 */
export async function securityReviewCheck(diff: string, changedFiles: string[]): Promise<RawCheck> {
  const start = Date.now();
  if (!diff.trim()) {
    return {
      name: "security-review", command: "", durationMs: Date.now() - start,
      status: "pass", errors: [], skippedReason: "No diff content to review.",
    };
  }

  let findings: RawFinding[] | null = null;
  try {
    const r = await getAI().completeJSON<{ findings: RawFinding[] }>(
      `You are a security reviewer. Review this diff for REAL security issues only:
injection (SQL/command/template), missing authentication or authorization on
endpoints, unsafe eval/exec/deserialization, SSRF, path traversal, secrets in
code, weak or homemade crypto, trusting unvalidated client input in dangerous
sinks. Do NOT flag style, performance, or hypothetical hardening.

Changed files: ${changedFiles.join(", ") || "(unknown)"}

DIFF:
${diff}

Return ONLY JSON: {"findings":[{"file":"path","line":123,"issue":"one precise sentence","severity":"critical|high|medium|low","confidence":0.0}]}. No real issues → {"findings":[]}.`,
      { tier: "cheap", maxTokens: 700 },
    );
    findings = r?.findings ?? null;
  } catch {
    findings = null;
  }

  if (findings === null) {
    return {
      name: "security-review", command: "", durationMs: Date.now() - start,
      status: "skipped", errors: [],
      skippedReason: "AI provider unavailable — pattern-based secret-scan still applies.",
    };
  }

  const errors: PreflightError[] = findings
    .filter((f) => f.issue && (f.confidence ?? 1) >= 0.6)
    .slice(0, 20)
    .map((f) => {
      const e = {
        file: f.file ?? "",
        line: typeof f.line === "number" ? f.line : undefined,
        code: `sec-${f.severity ?? "high"}`,
        message: f.issue,
      };
      return { ...e, id: fingerprint(e), category: "security" as const };
    });

  return {
    name: "security-review", command: "", durationMs: Date.now() - start,
    status: errors.length ? "fail" : "pass", errors,
  };
}
