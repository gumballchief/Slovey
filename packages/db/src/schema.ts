import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Embedding dimensions. MUST match config EMBEDDING_DIMENSIONS and the chosen
 * provider (voyage-3 = 1024; openai text-embedding-3-large requested at 1024).
 */
export const EMBEDDING_DIMS = 1024;

// ─────────────────────────── enums ───────────────────────────
export const accountType = pgEnum("account_type", ["User", "Organization"]);
export const membershipRole = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);
export const confidenceThreshold = pgEnum("confidence_threshold", [
  "low",
  "high",
  "strict",
]);
export const checkMode = pgEnum("check_mode", ["comment", "status_check"]);
export const decisionSource = pgEnum("decision_source", [
  "github_pr",
  "doc",
  "linear",
  "notion",
  "slack",
  "repo_analysis",
  "manual",
  "jira",
  "confluence",
  "discord",
]);
// Decision lifecycle. Legacy values (approved/suggested/removed) kept for back-compat;
// the platform uses the full lifecycle going forward.
export const decisionStatus = pgEnum("decision_status", [
  "approved",
  "suggested",
  "removed",
  "proposed",
  "candidate", // low-confidence / awaiting human review — never treated as truth
  "deprecated",
  "superseded",
  "rejected",
  "archived",
]);
export const decisionImportance = pgEnum("decision_importance", [
  "low",
  "medium",
  "high",
  "critical",
]);
// Human review state, distinct from lifecycle status.
export const decisionReview = pgEnum("decision_review", [
  "unreviewed",
  "confirmed",
  "needs_changes",
]);
// Typed relationships in the Engineering Decision Graph.
export const decisionEdgeType = pgEnum("decision_edge_type", [
  "implements",
  "supersedes",
  "contradicts",
  "related_to",
  "depends_on",
  "discussed_in",
  "approved_by",
  "owned_by",
  "created_from",
  "governs",
  "affects",
  "references",
  "duplicates",
  "replaces",
  "conflicts_with",
]);
// Entity types an edge can point at when the target isn't another decision.
export const graphEntityType = pgEnum("graph_entity_type", [
  "decision",
  "adr",
  "repository",
  "directory",
  "service",
  "module",
  "file",
  "api",
  "database",
  "engineer",
  "team",
  "issue",
  "rfc",
  "pr",
  "rejected_pr",
  "slack_thread",
  "meeting",
  "incident",
  "architecture_component",
]);
export const verdict = pgEnum("verdict", ["conflict", "clear", "skipped"]);
export const feedbackAction = pgEnum("feedback_action", ["dismiss", "confirm"]);
export const docType = pgEnum("doc_type", [
  "adr",
  "readme",
  "contributing",
  "docs",
]);
export const repoKnowledgeKind = pgEnum("repo_knowledge_kind", [
  "architecture",
  "dependency_graph",
  "patterns",
  "services",
]);

// ─────────────────────────── tenancy ───────────────────────────
export const orgPlan = pgEnum("org_plan", ["free", "pro", "enterprise"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: orgPlan("plan").notNull().default("free"),
  // Stripe linkage — set on first checkout; plan changes flow through webhooks.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// RBAC: who can do what within an organization.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("memberships_org_user_uq").on(t.orgId, t.userId)],
);

// ─────────────────────────── github wiring ───────────────────────────
export const installations = pgTable("installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubInstallationId: bigint("github_installation_id", { mode: "number" })
    .notNull()
    .unique(),
  accountLogin: text("account_login").notNull(),
  accountType: accountType("account_type").notNull(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const repos = pgTable("repos", {
  id: uuid("id").defaultRandom().primaryKey(),
  installationId: uuid("installation_id")
    .notNull()
    .references(() => installations.id, { onDelete: "cascade" }),
  githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().unique(),
  defaultBranch: text("default_branch").notNull().default("main"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const repoSettings = pgTable("repo_settings", {
  repoId: uuid("repo_id")
    .notNull()
    .unique()
    .references(() => repos.id, { onDelete: "cascade" }),
  confidenceThreshold: confidenceThreshold("confidence_threshold")
    .notNull()
    .default("high"),
  triggerOpened: boolean("trigger_opened").notNull().default(true),
  triggerSynchronize: boolean("trigger_synchronize").notNull().default(false),
  mode: checkMode("mode").notNull().default("comment"),
  learnFromDismissals: boolean("learn_from_dismissals").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────── the memory ───────────────────────────
export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    // `decision` is the canonical statement; `title`/`summary` give it a handle.
    title: text("title"),
    summary: text("summary"),
    decision: text("decision").notNull(),
    why: text("why").notNull().default(""),
    examples: text("examples").array().notNull().default(sql`'{}'::text[]`),
    // Citations like ["PR #29499"] or a doc path. Never empty for an approved decision.
    evidence: text("evidence").array().notNull().default(sql`'{}'::text[]`),
    source: decisionSource("source").notNull(),
    category: text("category"),
    status: decisionStatus("status").notNull().default("approved"),

    // ── governance / ownership ──
    ownerUser: text("owner_user"),
    owningTeam: text("owning_team"),
    importance: decisionImportance("importance").notNull().default("medium"),
    priority: integer("priority").notNull().default(0),
    // 0..1 extraction/judgement confidence. Candidates are low-confidence.
    confidence: doublePrecision("confidence").notNull().default(0.5),
    review: decisionReview("review").notNull().default("unreviewed"),

    // ── scope (denormalized for fast filtering; edges carry relationships) ──
    domains: text("domains").array().notNull().default(sql`'{}'::text[]`),
    services: text("services").array().notNull().default(sql`'{}'::text[]`),
    affectedRepos: text("affected_repos").array().notNull().default(sql`'{}'::text[]`),
    directories: text("directories").array().notNull().default(sql`'{}'::text[]`),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    frameworks: text("frameworks").array().notNull().default(sql`'{}'::text[]`),

    // ── temporal / lifecycle ──
    version: integer("version").notNull().default(1),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    supersededById: uuid("superseded_by_id"),
    // rejected knowledge: why it was rejected + what to do instead
    rejectionReason: text("rejection_reason"),
    alternatives: text("alternatives").array().notNull().default(sql`'{}'::text[]`),

    embedding: vector("embedding", { dimensions: EMBEDDING_DIMS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (t) => [
    index("decisions_repo_status_idx").on(t.repoId, t.status),
    index("decisions_repo_review_idx").on(t.repoId, t.review),
    // ANN index for pgvector cosine similarity retrieval.
    index("decisions_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// ─────────────────────────── decision graph: edges ───────────────────────────
// A typed, confidence-weighted, provenance-bearing relationship. The source is
// always a decision; the target is either another decision (toDecisionId) or an
// external entity (toEntityType + toEntityRef, e.g. service "billing", pr "#42").
export const decisionEdges = pgTable(
  "decision_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    fromDecisionId: uuid("from_decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    type: decisionEdgeType("type").notNull(),
    toDecisionId: uuid("to_decision_id").references(() => decisions.id, {
      onDelete: "cascade",
    }),
    toEntityType: graphEntityType("to_entity_type"),
    toEntityRef: text("to_entity_ref"),
    confidence: doublePrecision("confidence").notNull().default(1),
    provenance: jsonb("provenance"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("decision_edges_from_idx").on(t.fromDecisionId),
    index("decision_edges_to_idx").on(t.toDecisionId),
    index("decision_edges_entity_idx").on(t.repoId, t.toEntityType, t.toEntityRef),
  ],
);

// ─────────────────────────── decision graph: version history ───────────────────────────
export const decisionVersions = pgTable(
  "decision_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // full field snapshot at this version
    snapshot: jsonb("snapshot").notNull(),
    changedBy: text("changed_by"),
    changeNote: text("change_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("decision_versions_decision_idx").on(t.decisionId, t.version)],
);

// ─────────────────────────── checks ───────────────────────────
export const prChecks = pgTable(
  "pr_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    prTitle: text("pr_title").notNull(),
    prAuthor: text("pr_author").notNull(),
    headSha: text("head_sha").notNull(),
    verdict: verdict("verdict").notNull(),
    matchedDecisionId: uuid("matched_decision_id").references(() => decisions.id, {
      onDelete: "set null",
    }),
    confidence: text("confidence"),
    severity: text("severity"),
    explanation: text("explanation"),
    suggestedFix: text("suggested_fix"),
    githubCommentId: bigint("github_comment_id", { mode: "number" }),
    posted: boolean("posted").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Dedupe re-checks: one row per (repo, pr, head sha).
    unique("pr_checks_repo_pr_sha_uq").on(t.repoId, t.prNumber, t.headSha),
    index("pr_checks_repo_pr_idx").on(t.repoId, t.prNumber),
  ],
);

// ─────────────────────────── feedback (learn the team's noise) ───────────────────────────
export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  prCheckId: uuid("pr_check_id").references(() => prChecks.id, {
    onDelete: "set null",
  }),
  decisionId: uuid("decision_id").references(() => decisions.id, {
    onDelete: "set null",
  }),
  action: feedbackAction("action").notNull(),
  reason: text("reason"),
  byUser: text("by_user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────── Layer 3: external connectors ───────────────────────────
// One row per connected source per repo. Token is AES-256-GCM encrypted at rest
// (see packages/core/src/crypto.ts); never store or return the plaintext token.
export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // linear | notion | slack
    encryptedToken: text("encrypted_token").notNull(),
    config: jsonb("config"),
    status: text("status").notNull().default("connected"), // connected | syncing | error
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("connectors_repo_type_uq").on(t.repoId, t.type)],
);

// ─────────────────────────── Layer 2: docs ───────────────────────────
export const docSources = pgTable("doc_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  type: docType("type").notNull(),
  sha: text("sha"),
  lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
});

// ─────────────────────────── audit (enterprise) ───────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    repoId: uuid("repo_id").references(() => repos.id, { onDelete: "set null" }),
    actorUser: text("actor_user"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_logs_org_idx").on(t.orgId, t.createdAt)],
);

// ─────────────────────────── Phase-4 seam: structured repo knowledge ───────────────────────────
// Stubbed now so the architecture/dependency-graph parser can fill it later
// without a schema migration churn.
export const repoKnowledge = pgTable("repo_knowledge", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  kind: repoKnowledgeKind("kind").notNull(),
  data: jsonb("data").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────── agent runs ───────────────────────────
export const agentRunStatus = pgEnum("agent_run_status", ["queued", "running", "ready", "failed"]);

/** One auto-PR agent task: intent in → draft PR + self-review verdict out. */
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  intent: text("intent").notNull(),
  status: agentRunStatus("status").notNull().default("queued"),
  branch: text("branch"),
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  draft: boolean("draft").notNull().default(true),
  filePath: text("file_path"),
  isNewFile: boolean("is_new_file"),
  /** Every file the change touches: [{path, isNew}]. filePath keeps the first. */
  files: jsonb("files").notNull().default(sql`'[]'::jsonb`),
  decisionsUsed: integer("decisions_used").notNull().default(0),
  /** checkPr's self-review verdict on the agent's own PR (clear/conflict/…). */
  verdict: text("verdict"),
  reviewPosted: boolean("review_posted").notNull().default(false),
  /** Post-PR revise-until-clean rounds performed. */
  reviseRounds: integer("revise_rounds").notNull().default(0),
  ciState: text("ci_state"),
  ciSummary: text("ci_summary"),
  error: text("error"),
  requestedBy: text("requested_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────── preflight ───────────────────────────
export const preflightStatus = pgEnum("preflight_status", ["pass", "fail", "partial", "error"]);
export const preflightCheckStatus = pgEnum("preflight_check_status", ["pass", "fail", "skipped", "error"]);

/** One preflight invocation (one agent call / one gate run). */
export const preflightRuns = pgTable("preflight_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id").references(() => repos.id, { onDelete: "cascade" }),
  branch: text("branch"),
  commitSha: text("commit_sha"),
  mode: text("mode").notNull().default("full"),
  status: preflightStatus("status").notNull(),
  safeToCommit: boolean("safe_to_commit").notNull().default(false),
  safeToPush: boolean("safe_to_push").notNull().default(false),
  summary: text("summary").notNull().default(""),
  agentInstruction: text("agent_instruction").notNull().default(""),
  attemptId: text("attempt_id"),
  attempt: integer("attempt").notNull().default(1),
  maxAttempts: integer("max_attempts").notNull().default(5),
  humanReviewRequired: boolean("human_review_required").notNull().default(false),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const preflightChecks = pgTable("preflight_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull().references(() => preflightRuns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: preflightCheckStatus("status").notNull(),
  command: text("command").notNull().default(""),
  blocking: boolean("blocking").notNull().default(false),
  durationMs: integer("duration_ms").notNull().default(0),
  skippedReason: text("skipped_reason"),
  stdoutSummary: text("stdout_summary"),
  stderrSummary: text("stderr_summary"),
});

/** Raw parsed errors, one per parser hit, linked to the check row that produced them. */
export const preflightErrors = pgTable("preflight_errors", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull().references(() => preflightRuns.id, { onDelete: "cascade" }),
  checkId: uuid("check_id").references(() => preflightChecks.id, { onDelete: "cascade" }),
  checkName: text("check_name").notNull(),
  file: text("file").notNull().default(""),
  line: integer("line"),
  col: integer("col"),
  code: text("code"),
  category: text("category"),
  fingerprint: text("fingerprint"),
  message: text("message").notNull(),
  rawRedacted: text("raw_redacted"),
  blocking: boolean("blocking").notNull().default(false),
  // Legacy (pre-split) columns — new writes use preflight_fix_instructions.
  priority: text("priority"),
  instructionForAgent: text("instruction_for_agent"),
  evidence: text("evidence"),
});

/** Agent-directed fix instructions (deduped by fingerprint), one per action item. */
export const preflightFixInstructions = pgTable("preflight_fix_instructions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull().references(() => preflightRuns.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull().default(""),
  checkName: text("check_name"),
  priority: text("priority").notNull().default("medium"),
  file: text("file").notNull().default(""),
  problem: text("problem").notNull(),
  instructionForAgent: text("instruction_for_agent").notNull(),
  evidence: text("evidence"),
});

/** Loop-safety lineage: fingerprints of prior attempts on the same branch. */
export const preflightAttempts = pgTable("preflight_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id").references(() => repos.id, { onDelete: "cascade" }),
  runId: uuid("run_id").notNull().references(() => preflightRuns.id, { onDelete: "cascade" }),
  branch: text("branch"),
  attemptId: text("attempt_id"),
  attempt: integer("attempt").notNull().default(1),
  signature: text("signature").notNull().default(""),
  changedFiles: jsonb("changed_files").notNull().default(sql`'[]'::jsonb`),
  repeatedFailure: boolean("repeated_failure").notNull().default(false),
  unrelatedChangesDetected: boolean("unrelated_changes_detected").notNull().default(false),
  humanReviewRequired: boolean("human_review_required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const preflightDecisionViolations = pgTable("preflight_decision_violations", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull().references(() => preflightRuns.id, { onDelete: "cascade" }),
  decisionId: text("decision_id").notNull(),
  title: text("title").notNull().default(""),
  violation: text("violation").notNull().default(""),
  instructionForAgent: text("instruction_for_agent").notNull().default(""),
  confidence: doublePrecision("confidence").notNull().default(0),
  evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
});

/** Personal API tokens for the CLI / CI to authenticate to the hosted preflight
 *  API without a browser session or a direct DB connection. Only the SHA-256
 *  hash is stored; the plaintext `cb_…` is shown once at creation. Repo-scoped. */
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("cli"),
  /** SHA-256 hex of the plaintext token — the plaintext is never stored. */
  tokenHash: text("token_hash").notNull().unique(),
  /** Last 4 chars of the plaintext, for display (e.g. "cb_…a1b2"). */
  tokenHint: text("token_hint").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Human overrides: "I approve this change despite the decision" — first-class,
 *  attributed, time-boxed. Agents surface the override command; humans run it. */
export const preflightOverrides = pgTable("preflight_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  branch: text("branch"),
  reason: text("reason").notNull(),
  grantedBy: text("granted_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────── inferred types ───────────────────────────
export type AgentRun = typeof agentRuns.$inferSelect;
export type PreflightRun = typeof preflightRuns.$inferSelect;
export type PreflightCheck = typeof preflightChecks.$inferSelect;
export type PreflightErrorRow = typeof preflightErrors.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Installation = typeof installations.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type RepoSettings = typeof repoSettings.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type PrCheck = typeof prChecks.$inferSelect;
export type NewPrCheck = typeof prChecks.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type DocSource = typeof docSources.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
