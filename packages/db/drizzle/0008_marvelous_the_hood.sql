CREATE TYPE "public"."preflight_check_status" AS ENUM('pass', 'fail', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."preflight_status" AS ENUM('pass', 'fail');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preflight_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid,
	"run_id" uuid NOT NULL,
	"branch" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"signature" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preflight_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "preflight_check_status" NOT NULL,
	"command" text DEFAULT '' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"skipped_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preflight_decision_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"decision_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"violation" text DEFAULT '' NOT NULL,
	"instruction_for_agent" text DEFAULT '' NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preflight_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"check_name" text NOT NULL,
	"file" text DEFAULT '' NOT NULL,
	"line" integer,
	"code" text,
	"message" text NOT NULL,
	"priority" text,
	"instruction_for_agent" text,
	"evidence" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preflight_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid,
	"branch" text,
	"commit_sha" text,
	"status" "preflight_status" NOT NULL,
	"safe_to_commit" boolean DEFAULT false NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"human_review_required" boolean DEFAULT false NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_attempts" ADD CONSTRAINT "preflight_attempts_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_attempts" ADD CONSTRAINT "preflight_attempts_run_id_preflight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."preflight_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_checks" ADD CONSTRAINT "preflight_checks_run_id_preflight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."preflight_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_decision_violations" ADD CONSTRAINT "preflight_decision_violations_run_id_preflight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."preflight_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_errors" ADD CONSTRAINT "preflight_errors_run_id_preflight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."preflight_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_runs" ADD CONSTRAINT "preflight_runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
