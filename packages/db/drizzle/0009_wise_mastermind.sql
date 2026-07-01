CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"intent" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'queued' NOT NULL,
	"branch" text,
	"pr_number" integer,
	"pr_url" text,
	"draft" boolean DEFAULT true NOT NULL,
	"file_path" text,
	"is_new_file" boolean,
	"decisions_used" integer DEFAULT 0 NOT NULL,
	"verdict" text,
	"review_posted" boolean DEFAULT false NOT NULL,
	"error" text,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
