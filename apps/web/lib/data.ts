// ── Company Brain data layer ──
// This is the integration seam. Swap these mock exports for real API calls
// to the GitHub App, memory DB, and check pipeline.

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

// ── Repos ──────────────────────────────────────────────
export const REPOS: Repo[] = [
  {
    id: "acme-api",
    name: "acme/api",
    org: "Acme Corp",
    decisionsCount: 41,
    prsChecked: 187,
    conflictsCaught: 14,
    reviewTimeSaved: "23h",
    trend: [
      { week: "W1", conflicts: 2, clears: 18 },
      { week: "W2", conflicts: 3, clears: 21 },
      { week: "W3", conflicts: 1, clears: 24 },
      { week: "W4", conflicts: 4, clears: 19 },
      { week: "W5", conflicts: 2, clears: 27 },
      { week: "W6", conflicts: 2, clears: 22 },
    ],
  },
  {
    id: "acme-web",
    name: "acme/web",
    org: "Acme Corp",
    decisionsCount: 28,
    prsChecked: 94,
    conflictsCaught: 7,
    reviewTimeSaved: "11h",
    trend: [
      { week: "W1", conflicts: 1, clears: 12 },
      { week: "W2", conflicts: 2, clears: 14 },
      { week: "W3", conflicts: 0, clears: 18 },
      { week: "W4", conflicts: 2, clears: 16 },
      { week: "W5", conflicts: 1, clears: 20 },
      { week: "W6", conflicts: 1, clears: 10 },
    ],
  },
  {
    id: "acme-infra",
    name: "acme/infra",
    org: "Acme Corp",
    decisionsCount: 19,
    prsChecked: 52,
    conflictsCaught: 5,
    reviewTimeSaved: "8h",
    trend: [
      { week: "W1", conflicts: 0, clears: 7 },
      { week: "W2", conflicts: 1, clears: 9 },
      { week: "W3", conflicts: 1, clears: 8 },
      { week: "W4", conflicts: 2, clears: 10 },
      { week: "W5", conflicts: 0, clears: 12 },
      { week: "W6", conflicts: 1, clears: 4 },
    ],
  },
];

// ── Decisions ──────────────────────────────────────────
export const DECISIONS: Decision[] = [
  {
    id: "d1",
    decision: "Always fix the root cause, never band-aid bugs with defensive workarounds.",
    why: "Band-aid patches compound technical debt and mask systemic issues. Two PRs in one week addressed symptoms rather than root causes, causing the same bug to resurface.",
    examples: [
      "Adding a null check to hide an upstream data issue",
      "Catching and swallowing an exception instead of preventing it",
    ],
    evidence: ["PR #29295", "PR #29297"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-11-12T10:30:00Z",
    repoId: "acme-api",
  },
  {
    id: "d2",
    decision: "HTTP verbs must match the semantic contract: use PATCH for partial updates, not POST.",
    why: "Using POST instead of PATCH for a meeting update endpoint caused the server to create duplicate meetings for 300+ users. The contract was clear in our OpenAPI spec.",
    examples: [
      "PATCH /meetings/:id for partial updates",
      "POST /meetings for creation only",
    ],
    evidence: ["PR #29499"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-11-18T14:00:00Z",
    repoId: "acme-api",
  },
  {
    id: "d3",
    decision: "Runtime environment variables must not be inlined at build time via process.env.",
    why: "Inlining env vars at build time bakes them into the bundle, making environment-specific deploys impossible and leaking values into client bundles.",
    examples: [
      "Use NEXT_PUBLIC_ prefix only for truly public client values",
      "Server-only secrets must never appear in client bundles",
    ],
    evidence: ["PR #28182"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-10-05T09:15:00Z",
    repoId: "acme-web",
  },
  {
    id: "d4",
    decision: "Security-sensitive changes must go through the internal security review process, not community PRs.",
    why: "A community PR touched authentication middleware. Security-sensitive code paths require internal review to prevent disclosure of implementation details and ensure thorough audit.",
    examples: [
      "Auth middleware changes",
      "Cryptography implementations",
      "Permission boundary modifications",
    ],
    evidence: ["PR #29442"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-11-22T16:45:00Z",
    repoId: "acme-api",
  },
  {
    id: "d5",
    decision: "All new third-party payment integrations require a formal vendor review before implementation.",
    why: "Two PRs added payment integrations without review. Payments touch PCI scope — any new provider changes our compliance surface. All payment logic must be handled via our internal payments service.",
    examples: [
      "Stripe integrations go through payments-service, not directly in API",
      "No direct calls to Paystack, Flutterwave, or similar from app code",
    ],
    evidence: ["PR #29296", "PR #10803"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-09-30T11:00:00Z",
    repoId: "acme-api",
  },
  {
    id: "d6",
    decision: "Platform-specific deploy config files are rejected: render.yaml, fly.toml, Procfile, vercel.json.",
    why: "We deploy via our internal CI/CD pipeline. Committing platform-specific config files creates confusion about the deployment target, risks accidental deploys, and fragments our infra-as-code.",
    examples: [
      "render.yaml — rejected",
      "fly.toml — rejected",
      "Procfile — rejected",
      "vercel.json — rejected",
    ],
    evidence: ["PR #29501", "PR #29312"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-12-01T08:30:00Z",
    repoId: "acme-infra",
  },
  {
    id: "d7",
    decision: "Use the internal rate-limiter middleware for all public API endpoints, not per-route logic.",
    why: "Inconsistent rate limiting across routes led to a DDoS exposure on /search. Centralise via the middleware so every new route is protected by default.",
    examples: [
      "Apply rateLimiter() in middleware.ts, not inside route handlers",
    ],
    evidence: ["PR #28901"],
    source: "github_pr",
    status: "approved",
    createdAt: "2024-10-20T13:30:00Z",
    repoId: "acme-api",
  },
  {
    id: "d8",
    decision: "Database migrations must be backward-compatible for at least one deploy cycle.",
    why: "A column rename without a transitional alias broke the running app during the deploy window. Blue-green deploys require the old and new code to coexist safely.",
    examples: [
      "Add new column before dropping old one",
      "Keep old column name as alias during transition",
    ],
    evidence: ["PR #29103"],
    source: "doc",
    status: "approved",
    createdAt: "2024-10-28T10:00:00Z",
    repoId: "acme-api",
  },
  {
    id: "d9",
    decision: "All feature flags must be defined in the feature-flags.ts registry, not scattered inline.",
    why: "Inline flag checks spread across 12 files made it impossible to audit or clean up old flags. Central registry enables flag lifecycle management.",
    examples: [
      "import { flags } from '@/lib/feature-flags'",
      "Never: if (process.env.ENABLE_X === 'true')",
    ],
    evidence: ["PR #29388"],
    source: "doc",
    status: "approved",
    createdAt: "2024-11-08T09:00:00Z",
    repoId: "acme-web",
  },
  {
    id: "d10",
    decision: "Component tests must not mock child components — integration-style rendering only.",
    why: "Mocked tests passed while the real render broke due to prop changes in children. Full-tree rendering catches interface regressions that unit mocks miss.",
    examples: [
      "Use render() not shallow()",
      "Never: jest.mock('../Button')",
    ],
    evidence: ["PR #29201"],
    source: "doc",
    status: "suggested",
    createdAt: "2024-11-15T14:00:00Z",
    repoId: "acme-web",
  },
];

// ── Checked PRs ──────────────────────────────────────────
export const CHECKED_PRS: CheckedPR[] = [
  {
    number: 412,
    title: "Add render.yaml for Render.com deployment",
    author: "jsmith",
    verdict: "conflict",
    matchedDecision: "Platform-specific deploy config files are rejected: render.yaml, fly.toml, Procfile, vercel.json.",
    matchedDecisionId: "d6",
    citation: "PR #29501",
    postedComment:
      "**Company Brain** found a conflict with a past team decision.\n\n**Decision:** Platform-specific deploy config files are rejected — `render.yaml`, `fly.toml`, `Procfile`, `vercel.json`.\n\n**Why:** We deploy via our internal CI/CD pipeline. Committing platform-specific config creates confusion about the deployment target and risks accidental deploys.\n\n**Evidence:** PR #29501, PR #29312\n\n_Confidence: high · Source: github_pr_",
    checkedAt: "2024-12-10T09:12:00Z",
    repoId: "acme-infra",
  },
  {
    number: 411,
    title: "Refactor auth token refresh flow",
    author: "amara",
    verdict: "clear",
    checkedAt: "2024-12-10T08:55:00Z",
    repoId: "acme-api",
  },
  {
    number: 410,
    title: "Add Paystack payment integration",
    author: "devrel-bot",
    verdict: "conflict",
    matchedDecision: "All new third-party payment integrations require a formal vendor review before implementation.",
    matchedDecisionId: "d5",
    citation: "PR #29296",
    postedComment:
      "**Company Brain** found a conflict with a past team decision.\n\n**Decision:** All new third-party payment integrations require a formal vendor review before implementation. Payments must be handled through the internal payments-service.\n\n**Why:** Payments touch PCI scope — any new provider changes our compliance surface.\n\n**Evidence:** PR #29296, PR #10803\n\n_Confidence: high · Source: github_pr_",
    checkedAt: "2024-12-09T17:30:00Z",
    repoId: "acme-api",
  },
  {
    number: 409,
    title: "Add search endpoint with rate limiting",
    author: "mchen",
    verdict: "clear",
    checkedAt: "2024-12-09T14:20:00Z",
    repoId: "acme-api",
  },
  {
    number: 408,
    title: "Inline STRIPE_SECRET_KEY in client bundle for checkout",
    author: "intern-dev",
    verdict: "conflict",
    matchedDecision: "Runtime environment variables must not be inlined at build time via process.env.",
    matchedDecisionId: "d3",
    citation: "PR #28182",
    postedComment:
      "**Company Brain** found a conflict with a past team decision.\n\n**Decision:** Runtime environment variables must not be inlined at build time. Server-only secrets must never appear in client bundles.\n\n**Why:** Inlining env vars bakes them into the bundle, making environment-specific deploys impossible and leaking secrets.\n\n**Evidence:** PR #28182\n\n_Confidence: high · Source: github_pr_",
    checkedAt: "2024-12-09T11:05:00Z",
    repoId: "acme-web",
  },
  {
    number: 407,
    title: "Update CONTRIBUTING.md with PR review guidelines",
    author: "sarah-k",
    verdict: "clear",
    checkedAt: "2024-12-09T10:00:00Z",
    repoId: "acme-web",
  },
  {
    number: 406,
    title: "Fix null pointer in user profile service",
    author: "tom-b",
    verdict: "clear",
    checkedAt: "2024-12-08T16:45:00Z",
    repoId: "acme-api",
  },
  {
    number: 405,
    title: "Use POST /meetings instead of PATCH for meeting updates",
    author: "newcomer42",
    verdict: "conflict",
    matchedDecision: "HTTP verbs must match the semantic contract: use PATCH for partial updates, not POST.",
    matchedDecisionId: "d2",
    citation: "PR #29499",
    postedComment:
      "**Company Brain** found a conflict with a past team decision.\n\n**Decision:** HTTP verbs must match the semantic contract. Use PATCH for partial updates, not POST.\n\n**Why:** Using POST instead of PATCH for meeting updates caused duplicate meetings to be created for 300+ users.\n\n**Evidence:** PR #29499\n\n_Confidence: high · Source: github_pr_",
    checkedAt: "2024-12-08T14:00:00Z",
    repoId: "acme-api",
  },
  {
    number: 404,
    title: "Migrate feature flags to central registry",
    author: "sarah-k",
    verdict: "clear",
    checkedAt: "2024-12-07T09:30:00Z",
    repoId: "acme-web",
  },
  {
    number: 403,
    title: "Add fly.toml for Fly.io deployment",
    author: "devops-ext",
    verdict: "conflict",
    matchedDecision: "Platform-specific deploy config files are rejected: render.yaml, fly.toml, Procfile, vercel.json.",
    matchedDecisionId: "d6",
    citation: "PR #29501",
    postedComment:
      "**Company Brain** found a conflict with a past team decision.\n\n**Decision:** Platform-specific deploy config files are rejected — `render.yaml`, `fly.toml`, `Procfile`, `vercel.json`.\n\n**Evidence:** PR #29501\n\n_Confidence: high · Source: github_pr_",
    checkedAt: "2024-12-07T08:00:00Z",
    repoId: "acme-infra",
  },
];

// ── Connectors ──────────────────────────────────────────
export const CONNECTORS: Connector[] = [
  // Layer 1 — always connected (live)
  {
    id: "github",
    name: "GitHub",
    layer: 1,
    status: "connected",
    description: "PR history, merged code, and review comments.",
    deepens: "Every merged PR is a potential decision. Company Brain reads your history from day one.",
    icon: "github",
  },
  // Layer 2 — docs
  {
    id: "readme",
    name: "README / CONTRIBUTING",
    layer: 2,
    status: "connected",
    description: "Repo documentation files.",
    deepens: "Written conventions become searchable decisions.",
    icon: "file-text",
  },
  {
    id: "adrs",
    name: "ADRs / Docs folder",
    layer: 2,
    status: "connected",
    description: "Architecture Decision Records and /docs.",
    deepens: "Formal decisions get the highest confidence weighting.",
    icon: "book-open",
  },
  // Layer 3 — connect
  {
    id: "linear",
    name: "Linear",
    layer: 3,
    status: "available",
    description: "Issues, projects, and team decisions made in tickets.",
    deepens: "Rejected approaches documented in Linear become warnings in PRs.",
    icon: "layers",
  },
  {
    id: "jira",
    name: "Jira",
    layer: 3,
    status: "available",
    description: "Tickets, epics, and decision comments.",
    deepens: "Architecture decisions buried in Jira tickets surface automatically.",
    icon: "trello",
  },
  {
    id: "notion",
    name: "Notion",
    layer: 3,
    status: "available",
    description: "Wikis, RFCs, and team docs.",
    deepens: "Every RFC and decision doc feeds the memory.",
    icon: "layout",
  },
  {
    id: "confluence",
    name: "Confluence",
    layer: 3,
    status: "available",
    description: "Enterprise knowledge base and decision logs.",
    deepens: "Years of institutional knowledge become active PR context.",
    icon: "database",
  },
  {
    id: "slack",
    name: "Slack",
    layer: 3,
    status: "available",
    description: "Channel decisions, thread consensus, pinned messages.",
    deepens: "Capture the decisions that only exist in Slack threads.",
    icon: "message-square",
  },
  {
    id: "discord",
    name: "Discord",
    layer: 3,
    status: "available",
    description: "Community and team channel decisions.",
    deepens: "OSS project decisions from Discord feed the memory.",
    icon: "hash",
  },
  // Layer 4 — coming soon
  {
    id: "meetings",
    name: "Meeting Notes",
    layer: 4,
    status: "coming_soon",
    description: "Transcripts from Zoom, Google Meet, Loom.",
    deepens: "Verbal decisions get captured before they're forgotten.",
    icon: "video",
  },
];

// ── Helper functions ──────────────────────────────────────
export function getRepo(id: string): Repo {
  return REPOS.find((r) => r.id === id) ?? REPOS[0];
}

export function getDecisionsForRepo(repoId: string): Decision[] {
  return DECISIONS.filter((d) => d.repoId === repoId);
}

export function getPRsForRepo(repoId: string): CheckedPR[] {
  return CHECKED_PRS.filter((p) => p.repoId === repoId);
}

export function getDecisionById(id: string): Decision | undefined {
  return DECISIONS.find((d) => d.id === id);
}

export function getRecentActivity(
  repoId: string,
  limit = 5
): CheckedPR[] {
  return CHECKED_PRS.filter((p) => p.repoId === repoId)
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, limit);
}
