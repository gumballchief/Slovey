ALTER TABLE "agent_runs" ADD COLUMN "files" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "revise_rounds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_state" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_summary" text;