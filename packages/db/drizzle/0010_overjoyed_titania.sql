ALTER TYPE "public"."preflight_check_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TYPE "public"."preflight_status" ADD VALUE 'partial';--> statement-breakpoint
ALTER TYPE "public"."preflight_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TABLE "preflight_attempts" ADD COLUMN "attempt_id" text;--> statement-breakpoint
ALTER TABLE "preflight_attempts" ADD COLUMN "changed_files" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_attempts" ADD COLUMN "repeated_failure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_attempts" ADD COLUMN "unrelated_changes_detected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_attempts" ADD COLUMN "human_review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_checks" ADD COLUMN "blocking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_checks" ADD COLUMN "stdout_summary" text;--> statement-breakpoint
ALTER TABLE "preflight_checks" ADD COLUMN "stderr_summary" text;--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "raw_redacted" text;--> statement-breakpoint
ALTER TABLE "preflight_runs" ADD COLUMN "mode" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_runs" ADD COLUMN "safe_to_push" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_runs" ADD COLUMN "agent_instruction" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_runs" ADD COLUMN "attempt_id" text;