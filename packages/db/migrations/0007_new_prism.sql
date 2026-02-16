CREATE TYPE "public"."share_level" AS ENUM('summary', 'issues', 'full');--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "share_level" "share_level" DEFAULT 'summary';--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "share_expires_at" timestamp;