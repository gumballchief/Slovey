"use client";

import { Ref } from "@/ui/kit";

/** GitHub URL for a PR in the active repo ("owner/name"). */
export function prUrl(repoName: string | undefined, n: number | string): string | undefined {
  if (!repoName || !repoName.includes("/")) return undefined;
  return `https://github.com/${repoName}/pull/${n}`;
}

/**
 * Evidence comes from the extractor as short strings ("PR #418", "#455 review",
 * "INC-2207", "ADR-019", a URL, or a doc path). Render each as a reference chip:
 * PRs and ADRs in blue, incidents in red, links clickable.
 */
export function EvidenceRef({ e, repoName, plain }: { e: string; repoName?: string; plain?: boolean }) {
  const text = e.trim();
  const url = text.match(/https?:\/\/\S+/)?.[0];
  const pr = text.match(/#(\d+)/);
  const incident = /\b(INC|SEV|INCIDENT)[-_ ]?\d+/i.test(text);
  if (url) {
    const ghPr = url.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
    return <Ref href={plain ? undefined : url}>{ghPr ? `#${ghPr[1]}` : shorten(url.replace(/^https?:\/\//, ""))}</Ref>;
  }
  if (pr) return <Ref href={plain ? undefined : prUrl(repoName, pr[1]!)} red={incident}>{shorten(text)}</Ref>;
  return <Ref red={incident}>{shorten(text)}</Ref>;
}

export function EvidenceList({
  evidence,
  repoName,
  max = 6,
  plain,
}: {
  evidence: string[];
  repoName?: string;
  max?: number;
  /** Inside another link (a card): chips must not be links themselves. */
  plain?: boolean;
}) {
  if (!evidence?.length) return null;
  const shown = evidence.slice(0, max);
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {shown.map((e, i) => (
        <EvidenceRef key={`${e}-${i}`} e={e} repoName={repoName} plain={plain} />
      ))}
      {evidence.length > max && <span className="ui-small">+{evidence.length - max} more</span>}
    </span>
  );
}

function shorten(s: string, n = 42): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Where a decision was learned from, in plain words. */
export const SOURCE_LABEL: Record<string, string> = {
  github_pr: "Pull request",
  doc: "Doc",
  linear: "Linear",
  notion: "Notion",
  slack: "Slack",
  jira: "Jira",
  confluence: "Confluence",
  discord: "Discord",
  pagerduty: "PagerDuty",
  repo_analysis: "Code analysis",
  manual: "Added by hand",
};
