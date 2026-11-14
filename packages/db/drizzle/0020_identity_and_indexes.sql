-- Identity by immutable GitHub ids (orgs by account id, repos by repo id), plus
-- the missing indexes on preflight history and agent runs. All additive.
-- A repo renamed on GitHub before this migration may already have two rows; the
-- unique rule below would then fail mid-way, so stop first with a clear message
-- instead. (The migrator runs in one transaction: nothing is half-applied.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "repos" GROUP BY "github_repo_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'repos has more than one row for the same github_repo_id (a renamed or transferred repo was synced twice). Merge those rows, then rerun this migration.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "github_account_id" bigint;--> statement-breakpoint
CREATE INDEX "agent_runs_repo_created_idx" ON "agent_runs" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "preflight_attempts_run_idx" ON "preflight_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "preflight_attempts_repo_branch_created_idx" ON "preflight_attempts" USING btree ("repo_id","branch","created_at");--> statement-breakpoint
CREATE INDEX "preflight_checks_run_idx" ON "preflight_checks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "preflight_decision_violations_run_idx" ON "preflight_decision_violations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "preflight_errors_run_idx" ON "preflight_errors" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "preflight_errors_fingerprint_idx" ON "preflight_errors" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "preflight_fix_instructions_run_idx" ON "preflight_fix_instructions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "preflight_runs_repo_created_idx" ON "preflight_runs" USING btree ("repo_id","created_at");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_github_account_id_unique" UNIQUE("github_account_id");--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_github_repo_id_unique" UNIQUE("github_repo_id");