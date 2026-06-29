CREATE TYPE "public"."decision_edge_type" AS ENUM('implements', 'supersedes', 'contradicts', 'related_to', 'depends_on', 'discussed_in', 'approved_by', 'owned_by', 'created_from', 'governs', 'affects', 'references', 'duplicates', 'replaces', 'conflicts_with');--> statement-breakpoint
CREATE TYPE "public"."decision_importance" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."decision_review" AS ENUM('unreviewed', 'confirmed', 'needs_changes');--> statement-breakpoint
CREATE TYPE "public"."graph_entity_type" AS ENUM('decision', 'adr', 'repository', 'directory', 'service', 'module', 'file', 'api', 'database', 'engineer', 'team', 'issue', 'rfc', 'pr', 'rejected_pr', 'slack_thread', 'meeting', 'incident', 'architecture_component');--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'candidate';--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'deprecated';--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'superseded';--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."decision_status" ADD VALUE 'archived';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"from_decision_id" uuid NOT NULL,
	"type" "decision_edge_type" NOT NULL,
	"to_decision_id" uuid,
	"to_entity_type" "graph_entity_type",
	"to_entity_ref" text,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" text,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "owner_user" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "owning_team" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "importance" "decision_importance" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "confidence" double precision DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "review" "decision_review" DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "domains" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "services" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "affected_repos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "directories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "frameworks" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "superseded_by_id" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "alternatives" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_edges" ADD CONSTRAINT "decision_edges_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_edges" ADD CONSTRAINT "decision_edges_from_decision_id_decisions_id_fk" FOREIGN KEY ("from_decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_edges" ADD CONSTRAINT "decision_edges_to_decision_id_decisions_id_fk" FOREIGN KEY ("to_decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_versions" ADD CONSTRAINT "decision_versions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_edges_from_idx" ON "decision_edges" USING btree ("from_decision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_edges_to_idx" ON "decision_edges" USING btree ("to_decision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_edges_entity_idx" ON "decision_edges" USING btree ("repo_id","to_entity_type","to_entity_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_versions_decision_idx" ON "decision_versions" USING btree ("decision_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decisions_repo_review_idx" ON "decisions" USING btree ("repo_id","review");