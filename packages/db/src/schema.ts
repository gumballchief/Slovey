import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
export const decisionStatus = pgEnum("decision_status", [
  "approved",
  "suggested",
  "removed",
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
    decision: text("decision").notNull(),
    why: text("why").notNull().default(""),
    examples: text("examples").array().notNull().default(sql`'{}'::text[]`),
    // Citations like ["PR #29499"] or a doc path. Never empty for an approved decision.
    evidence: text("evidence").array().notNull().default(sql`'{}'::text[]`),
    source: decisionSource("source").notNull(),
    category: text("category"),
    status: decisionStatus("status").notNull().default("approved"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMS }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (t) => [
    index("decisions_repo_status_idx").on(t.repoId, t.status),
    // ANN index for pgvector cosine similarity retrieval.
    index("decisions_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
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

// ─────────────────────────── inferred types ───────────────────────────
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
