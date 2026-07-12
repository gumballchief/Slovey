// ── Slovey shared UI types ──
// The canonical client-side shapes for dashboard data. All values come from the
// real API (see lib/api-client.ts) — there is no mock/seed data. These types
// mirror the API responses (ApiDecision / ApiRepo / etc. in the core service).

export type Decision = {
  id: string;
  decision: string;
  why: string;
  examples: string[];
  evidence: string[];
  source:
    | "github_pr"
    | "doc"
    | "linear"
    | "notion"
    | "slack"
    | "jira"
    | "confluence"
    | "discord"
    | "repo_analysis"
    | "manual";
  status?: "approved" | "suggested";
  createdAt: string;
  repoId: string;
};

export type CheckedPR = {
  number: number;
  title: string;
  author: string;
  verdict: "conflict" | "clear";
  matchedDecision?: string;
  matchedDecisionId?: string;
  citation?: string;
  postedComment?: string;
  severity?: "low" | "medium" | "high" | "critical";
  suggestedFix?: string;
  checkedAt: string;
  repoId: string;
};

export type Repo = {
  id: string;
  name: string;
  org: string;
  decisionsCount: number;
  prsChecked: number;
  conflictsCaught: number;
  reviewTimeSaved: string;
  trend: { week: string; conflicts: number; clears: number }[];
};

export type ConnectorStatus = "connected" | "available" | "coming_soon";

export type Connector = {
  id: string;
  name: string;
  layer: 1 | 2 | 3 | 4;
  status: ConnectorStatus;
  description: string;
  deepens: string;
  icon: string;
  /** Live state when a connector has been configured for the repo. */
  lastSyncedAt?: string | null;
  lastError?: string | null;
  syncing?: boolean;
};
