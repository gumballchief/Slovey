CREATE TABLE IF NOT EXISTS "preflight_fix_instructions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"check_name" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"file" text DEFAULT '' NOT NULL,
	"problem" text NOT NULL,
	"instruction_for_agent" text NOT NULL,
	"evidence" text
);
--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "check_id" uuid;--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "col" integer;--> statement-breakpoint
ALTER TABLE "preflight_errors" ADD COLUMN "blocking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_fix_instructions" ADD CONSTRAINT "preflight_fix_instructions_run_id_preflight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."preflight_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preflight_errors" ADD CONSTRAINT "preflight_errors_check_id_preflight_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."preflight_checks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
