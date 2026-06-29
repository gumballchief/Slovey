CREATE TYPE "public"."org_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan" "org_plan" DEFAULT 'free' NOT NULL;