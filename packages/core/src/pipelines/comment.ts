/** Hidden marker used to find our own comment on re-checks (no double-posting). */
export const COMMENT_MARKER = "<!-- company-brain -->";

const SEVERITY_LABEL: Record<string, string> = {
  low: "🟡 Low",
  medium: "🟠 Medium",
  high: "🔴 High",
  critical: "🚨 Critical",
};

export interface CommentInput {
  explanation: string;
  decision: string;
  citation: string;
  confidence: string;
  severity?: string;
  suggestedFix?: string;
}

/**
 * Build the PR comment in the prototype's quiet tone. Always carries the
 * decision + citation (the guardrail guarantees both resolve before we get here),
 * plus severity and a suggested fix when the judge provided them.
 */
export function buildComment(input: CommentInput): string {
  const severityLine = input.severity
    ? `\n**Severity:** ${SEVERITY_LABEL[input.severity] ?? input.severity}`
    : "";
  const fixLine = input.suggestedFix
    ? `\n**Suggested fix:** ${input.suggestedFix}`
    : "";

  return `👋 **Heads up before review** — this looks like it may conflict with a past team decision.

**Likely issue:** ${input.explanation}
**Decision:** ${input.decision}
**Based on:** ${input.citation}${severityLine}${fixLine}

If this is intentional or things have changed, reply \`/brain dismiss\`. _(Automated pre-check · confidence: ${input.confidence})_
${COMMENT_MARKER}`;
}

/**
 * Replace a prior warning when the PR no longer conflicts — because it was fixed
 * or the decision was dismissed — so a stale warning never lingers on the PR.
 */
export function buildResolvedComment(reason: string): string {
  const note =
    reason === "decision-dismissed"
      ? "The team dismissed this decision, so it's no longer flagged here."
      : "This PR no longer conflicts with a past team decision.";
  return `✅ **Resolved** — ${note}
_(Automated pre-check · updated by Company Brain)_
${COMMENT_MARKER}`;
}
