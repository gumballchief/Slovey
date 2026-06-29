// ── Dashboard data layer (client) ──
// Calls the real API route handlers. If the backend/DB isn't up, it falls back
// to the bundled mock data so the demo still renders. This is the clearly-marked
// integration seam: when Postgres + the GitHub App are configured, every screen
// is live; otherwise it's a faithful demo.

import {
  CHECKED_PRS,
  CONNECTORS,
  DECISIONS,
  REPOS,
  getDecisionsForRepo,
  getPRsForRepo,
  getRepo,
  type CheckedPR,
  type Connector,
  type Decision,
  type Repo,
} from "@/lib/data";

export interface RepoSettings {
  confidenceThreshold: "low" | "high" | "strict";
  triggerOpened: boolean;
  triggerSynchronize: boolean;
  mode: "comment" | "status_check";
  learnFromDismissals: boolean;
}

const DEFAULT_SETTINGS: RepoSettings = {
  confidenceThreshold: "high",
  triggerOpened: true,
  triggerSynchronize: false,
  mode: "comment",
  learnFromDismissals: true,
};

async function getJSON<T>(url: string, fallback: () => T): Promise<T> {
  try {
    // Dynamic data — never serve a cached/stale response.
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    return fallback();
  }
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${url} failed: ${res.status} ${text}`);
  }
  return (await res.json().catch(() => ({}))) as T;
}

// ── reads (with mock fallback) ──
export function fetchRepos(): Promise<Repo[]> {
  return getJSON<Repo[]>("/api/repos", () => REPOS).then((r) => (r.length ? r : REPOS));
}

export function fetchDecisions(
  repoId: string,
  opts: { query?: string; source?: string } = {},
): Promise<Decision[]> {
  const params = new URLSearchParams();
  if (opts.query) params.set("q", opts.query);
  if (opts.source && opts.source !== "all") params.set("source", opts.source);
  const qs = params.toString();
  return getJSON<Decision[]>(
    `/api/repos/${repoId}/decisions${qs ? `?${qs}` : ""}`,
    () => getDecisionsForRepo(repoId),
  );
}

/** Semantic search over decisions (falls back to local substring search). */
export function searchDecisions(repoId: string, q: string): Promise<Decision[]> {
  return getJSON<Decision[]>(`/api/repos/${repoId}/search?q=${encodeURIComponent(q)}`, () => {
    const ql = q.toLowerCase();
    const all = getDecisionsForRepo(repoId);
    if (!ql) return all;
    return all.filter(
      (d) =>
        d.decision.toLowerCase().includes(ql) ||
        d.why.toLowerCase().includes(ql) ||
        d.evidence.some((e) => e.toLowerCase().includes(ql)),
    );
  });
}

export function fetchPRs(repoId: string): Promise<CheckedPR[]> {
  return getJSON<CheckedPR[]>(`/api/repos/${repoId}/pull-requests`, () =>
    getPRsForRepo(repoId).sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
    ),
  );
}

export type PRDetail = CheckedPR & { citation?: string; decision?: Decision };

export function fetchPR(repoId: string, number: number): Promise<PRDetail | null> {
  return getJSON<PRDetail | null>(`/api/repos/${repoId}/pull-requests/${number}`, () => {
    const pr = getPRsForRepo(repoId).find((p) => p.number === number) ?? null;
    return pr as PRDetail | null;
  });
}

export interface RepoArchitecture {
  languages: Record<string, number>;
  frameworks: string[];
  services: Array<{ name: string; path: string; kind: string }>;
  apiRoutes: string[];
  testStrategy: { hasTests: boolean; runners: string[]; testFileCount: number };
  fileCount: number;
  topLevelDirs: string[];
  summary: string;
}
export interface RepoKnowledge {
  architecture: RepoArchitecture | null;
  dependencyGraph: { nodes: Array<{ id: string; type: "internal" | "external" }>; edges: Array<{ from: string; to: string }> } | null;
  generatedAt: string | null;
}

export function fetchArchitecture(repoId: string): Promise<RepoKnowledge> {
  return getJSON<RepoKnowledge>(`/api/repos/${repoId}/architecture`, () => ({
    architecture: null,
    dependencyGraph: null,
    generatedAt: null,
  }));
}

export interface OrgMember {
  id: string;
  login: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  actorUser: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}
export interface OrgOverview {
  org: { id: string; name: string; slug: string } | null;
  viewer: { login: string; role: string };
  members: OrgMember[];
  audit: AuditEntry[];
}

export function fetchOrg(repoId: string): Promise<OrgOverview> {
  return getJSON<OrgOverview>(`/api/repos/${repoId}/org`, () => ({
    org: null,
    viewer: { login: "dev", role: "owner" },
    members: [],
    audit: [],
  }));
}

export type OrgPlan = "free" | "pro" | "enterprise";
export interface Billing {
  org: { id: string; name: string };
  plan: OrgPlan;
  usage: { repos: number; members: number; decisions: number; prsChecked: number; conflictsCaught: number };
  limits: { repos: number; decisions: number };
}

export function fetchBilling(repoId: string): Promise<Billing> {
  return getJSON<Billing>(`/api/repos/${repoId}/billing`, () => ({
    org: { id: "", name: "—" },
    plan: "free",
    usage: { repos: 0, members: 0, decisions: 0, prsChecked: 0, conflictsCaught: 0 },
    limits: { repos: 1, decisions: 200 },
  }));
}

export function changePlan(repoId: string, plan: OrgPlan) {
  return send<Omit<Billing, "org">>(`/api/repos/${repoId}/billing`, "PATCH", { plan });
}

export interface Me {
  login: string;
  email: string | null;
  avatarUrl: string | null;
  githubId: number | null;
  isDev: boolean;
  memberships: Array<{ orgId: string; orgName: string; orgSlug: string; role: string; joinedAt: string }>;
}

export function fetchMe(): Promise<Me> {
  return getJSON<Me>(`/api/me`, () => ({
    login: "dev",
    email: null,
    avatarUrl: null,
    githubId: null,
    isDev: true,
    memberships: [],
  }));
}

export function fetchConnectors(repoId: string): Promise<Connector[]> {
  return getJSON<Connector[]>(`/api/repos/${repoId}/connectors`, () => CONNECTORS);
}

export function connectConnector(
  repoId: string,
  type: string,
  token: string,
  config?: { channels?: string[]; baseUrl?: string; email?: string; limit?: number },
) {
  return send<{ connector: { id: string; type: string; status: string }; jobId: string | null }>(
    `/api/repos/${repoId}/connectors/${type}/connect`,
    "POST",
    { token, config },
  );
}

export function syncConnector(repoId: string, type: string) {
  return send<{ jobId: string | null; status: string }>(
    `/api/repos/${repoId}/connectors/${type}`,
    "POST",
  );
}

export function disconnectConnector(repoId: string, type: string) {
  return send<{ removed: boolean }>(`/api/repos/${repoId}/connectors/${type}`, "DELETE");
}

export function fetchSettings(repoId: string): Promise<RepoSettings> {
  return getJSON<RepoSettings>(`/api/repos/${repoId}/settings`, () => DEFAULT_SETTINGS);
}

// ── writes (no fallback — surface errors to the caller) ──
export function patchSettings(repoId: string, patch: Partial<RepoSettings>) {
  return send<RepoSettings>(`/api/repos/${repoId}/settings`, "PATCH", patch);
}

export function rebuildMemory(repoId: string) {
  return send<{ jobId: string | null; status: string }>(`/api/repos/${repoId}/rebuild`, "POST");
}

export function createDecision(repoId: string, input: Partial<Decision> & { decision: string }) {
  return send<Decision>(`/api/repos/${repoId}/decisions`, "POST", input);
}

export function updateDecision(repoId: string, id: string, patch: Partial<Decision>) {
  return send<Decision>(`/api/repos/${repoId}/decisions/${id}`, "PATCH", patch);
}

export function deleteDecision(repoId: string, id: string) {
  return send<{ ok: boolean }>(`/api/repos/${repoId}/decisions/${id}`, "DELETE");
}

export function postFeedback(
  repoId: string,
  input: { prNumber?: number; decisionId?: string; action: "dismiss" | "confirm"; reason?: string },
) {
  return send(`/api/repos/${repoId}/feedback`, "POST", input);
}

// ── Ask Company Brain (reasoning over the decision graph) ──
// No mock fallback: these need the live brain (DB + LLM). Errors surface so the
// UI can show an honest failure rather than a fabricated answer.

export type Confidence = "high" | "medium" | "low" | "none";

export interface BrainCitation {
  decisionId: string;
  title: string;
  decision: string;
  status: string;
  evidence: string[];
  freshness: number;
}

export interface AskAnswer {
  question: string;
  answer: string;
  confidence: Confidence;
  citations: BrainCitation[];
  reasoning: string[];
}

export interface RejectedPrecedent {
  decision: string;
  rejectionReason: string | null;
  alternatives: string[];
}

export interface CanIAnswer {
  intent: string;
  verdict: "allowed" | "disallowed" | "unclear";
  rationale: string;
  citations: BrainCitation[];
  rejectedPrecedent: RejectedPrecedent[];
}

export interface PlanAnswer {
  request: string;
  intent: string;
  scope: Record<string, string[]>;
  verdict: "allowed" | "disallowed" | "unclear";
  risk: "low" | "medium" | "high";
  confidence: Confidence;
  summary: string;
  steps: Array<{ title: string; detail: string }>;
  constraints: Array<{ decision: string; why: string; evidence: string[] }>;
  rejectedPrecedent: Array<{ decision: string; rejectionReason: string | null; alternatives: string[] }>;
  conflicts: string[];
  citations: BrainCitation[];
  reasoning: string[];
}

async function getOrThrow<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function askBrain(repoId: string, question: string): Promise<AskAnswer> {
  return getOrThrow<AskAnswer>(`/api/repos/${repoId}/ask?q=${encodeURIComponent(question)}`);
}

export function canIBrain(repoId: string, intent: string): Promise<CanIAnswer> {
  return send<CanIAnswer>(`/api/repos/${repoId}/can-i`, "POST", { intent });
}

export function planBrain(repoId: string, request: string): Promise<PlanAnswer> {
  return send<PlanAnswer>(`/api/repos/${repoId}/plan`, "POST", { request });
}

export { REPOS, getRepo };
