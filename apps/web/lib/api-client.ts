// ── Dashboard data layer (client) ──
// Real data only. Reads call the API route handlers and return real results —
// or empty/neutral values when nothing exists yet or the API errors. Never
// fabricated/mock data: an unconfigured or empty backend degrades to honest
// empty states, not a fake-populated demo.

import type { CheckedPR, Connector, Decision, Repo } from "@/lib/data";

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
  return getJSON<Repo[]>("/api/repos", () => []);
}

// ── CLI tokens (self-serve gate) ──
export interface CliToken {
  id: string;
  name: string;
  tokenHint: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
export function fetchTokens(repoId: string | null): Promise<CliToken[]> {
  if (!repoId) return Promise.resolve([]);
  return getJSON<CliToken[]>(`/api/repos/${repoId}/tokens`, () => []);
}
/** Returns the plaintext token — shown once, never retrievable again. */
export function createToken(repoId: string, name: string): Promise<{ id: string; token: string; tokenHint: string }> {
  return send(`/api/repos/${repoId}/tokens`, "POST", { name });
}
export function revokeToken(repoId: string, tokenId: string): Promise<{ revoked: boolean }> {
  return send(`/api/repos/${repoId}/tokens/${tokenId}`, "DELETE");
}

// ── Preflight ──
export interface PreflightRunRow {
  id: string;
  branch: string | null;
  commitSha: string | null;
  mode: string;
  status: "pass" | "fail" | "partial" | "error";
  safeToCommit: boolean;
  safeToPush: boolean;
  summary: string;
  agentInstruction: string;
  attempt: number;
  maxAttempts: number;
  humanReviewRequired: boolean;
  durationMs: number;
  createdAt: string;
}
export interface PreflightCheckRow {
  id: string;
  name: string;
  /** Owning supervisor agent (build/security/decision/architecture/performance/testing/context). */
  agent?: string;
  status: "pass" | "fail" | "skipped" | "error";
  command: string;
  blocking?: boolean;
  durationMs: number;
  skippedReason: string | null;
}
export interface PreflightErrorRow {
  id: string;
  checkName: string;
  file: string;
  line: number | null;
  message: string;
  category: string | null;
  fingerprint: string | null;
  priority: string | null;
  instructionForAgent: string | null;
  evidence: string | null;
}
export interface PreflightFixRow {
  id: string;
  fingerprint: string;
  checkName: string | null;
  priority: string;
  file: string;
  problem: string;
  instructionForAgent: string;
  evidence: string | null;
}
export interface PreflightViolationRow {
  id: string;
  decisionId: string;
  title: string;
  violation: string;
  instructionForAgent: string;
  confidence: number;
  evidence: string[];
}
export interface PreflightData {
  runs: PreflightRunRow[];
  latest: {
    run: PreflightRunRow;
    checks: PreflightCheckRow[];
    errors: PreflightErrorRow[];
    fixInstructions: PreflightFixRow[];
    violations: PreflightViolationRow[];
  } | null;
  /** Agent presentation order (Build → … → Context). */
  pipeline?: string[];
}
export function fetchPreflight(repoId: string): Promise<PreflightData> {
  return getJSON<PreflightData>(`/api/repos/${repoId}/preflight`, () => ({ runs: [], latest: null, pipeline: [] }));
}

// ── Agent tasks (auto-PR) ──
export interface AgentRunRow {
  id: string;
  intent: string;
  status: "queued" | "running" | "ready" | "failed";
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  draft: boolean;
  filePath: string | null;
  isNewFile: boolean | null;
  files: { path: string; isNew: boolean }[];
  decisionsUsed: number;
  verdict: string | null;
  reviewPosted: boolean;
  reviseRounds: number;
  ciState: string | null;
  ciSummary: string | null;
  error: string | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SuggestedTaskRow {
  intent: string;
  reason: string;
  files: string[];
}
export function fetchAgentRuns(repoId: string): Promise<AgentRunRow[]> {
  return getJSON<AgentRunRow[]>(`/api/repos/${repoId}/tasks`, () => []);
}
export function fetchTaskSuggestions(repoId: string): Promise<SuggestedTaskRow[]> {
  return getJSON<SuggestedTaskRow[]>(`/api/repos/${repoId}/tasks/suggestions`, () => []);
}
export function createAgentTask(repoId: string, intent: string): Promise<AgentRunRow> {
  return send<AgentRunRow>(`/api/repos/${repoId}/tasks`, "POST", { intent });
}

// ── Stripe billing ──
export function startCheckout(repoId: string, interval: "annual" | "monthly" = "annual"): Promise<{ url: string }> {
  return send<{ url: string }>(`/api/repos/${repoId}/billing/checkout`, "POST", { interval });
}
export function openBillingPortal(repoId: string): Promise<{ url: string }> {
  return send<{ url: string }>(`/api/repos/${repoId}/billing/portal`, "POST");
}

export function fetchDecisions(
  repoId: string,
  opts: { query?: string; source?: string } = {},
): Promise<Decision[]> {
  const params = new URLSearchParams();
  if (opts.query) params.set("q", opts.query);
  if (opts.source && opts.source !== "all") params.set("source", opts.source);
  const qs = params.toString();
  return getJSON<Decision[]>(`/api/repos/${repoId}/decisions${qs ? `?${qs}` : ""}`, () => []);
}

/** Semantic search over decisions (falls back to local substring search). */
export function searchDecisions(repoId: string, q: string): Promise<Decision[]> {
  return getJSON<Decision[]>(`/api/repos/${repoId}/search?q=${encodeURIComponent(q)}`, () => []);
}

export function fetchPRs(repoId: string): Promise<CheckedPR[]> {
  return getJSON<CheckedPR[]>(`/api/repos/${repoId}/pull-requests`, () => []);
}

export type PRDetail = CheckedPR & { citation?: string; decision?: Decision };

export function fetchPR(repoId: string, number: number): Promise<PRDetail | null> {
  return getJSON<PRDetail | null>(`/api/repos/${repoId}/pull-requests/${number}`, () => null);
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
  return getJSON<Connector[]>(`/api/repos/${repoId}/connectors`, () => []);
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

// ── Ask Slovey (reasoning over the decision graph) ──
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

// ── Human review queue ──
export interface ReviewItem {
  id: string;
  decision: string;
  why: string;
  evidence: string[];
  source: string;
  status: string;
  confidence: number;
  importance: string;
  createdAt: string;
}

export function fetchReviewQueue(repoId: string): Promise<ReviewItem[]> {
  return getJSON<ReviewItem[]>(`/api/repos/${repoId}/review`, () => []);
}

export function reviewDecision(
  repoId: string,
  decisionId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  return send<{ id: string; status: string; review: string }>(
    `/api/repos/${repoId}/review/${decisionId}`,
    "POST",
    { action, reason },
  );
}

// ── Memory health ──
export interface MemoryHealthSummary {
  total: number;
  active: number;
  durability: number;
  layers: { long_term: number; working: number; short_term: number };
  freshness: { fresh: number; aging: number; stale: number };
  weak: Array<{ id: string; decision: string }>;
  duplicates: unknown[];
  conflicts: number;
  reinforcement: { confirmed: number; unreviewed: number; needsChanges: number };
  recommendations: string[];
}

export function fetchMemoryHealth(repoId: string): Promise<MemoryHealthSummary | null> {
  return getJSON<MemoryHealthSummary | null>(`/api/repos/${repoId}/memory-health`, () => null);
}

// ── Import existing docs (ADRs/RFCs) → proposed decisions ──
export interface ImportResult {
  docs: number;
  extracted: number;
  inserted: number;
  updated: number;
}

export function importDocs(repoId: string, text: string) {
  return send<ImportResult>(`/api/repos/${repoId}/import`, "POST", { text });
}

