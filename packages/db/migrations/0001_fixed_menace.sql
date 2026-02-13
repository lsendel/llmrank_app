CREATE TYPE "public"."crawl_schedule" AS ENUM('manual', 'daily', 'weekly', 'monthly');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "crawl_schedule" "crawl_schedule" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_crawl_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_on_crawl_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_on_score_drop" boolean DEFAULT true NOT NULL;