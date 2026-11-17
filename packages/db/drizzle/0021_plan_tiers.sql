ALTER TYPE "public"."org_plan" ADD VALUE IF NOT EXISTS 'team' BEFORE 'enterprise';--> statement-breakpoint
ALTER TYPE "public"."org_plan" ADD VALUE IF NOT EXISTS 'business' BEFORE 'enterprise';--> statement-breakpoint
ALTER TYPE "public"."org_plan" ADD VALUE IF NOT EXISTS 'scale' BEFORE 'enterprise';