CREATE TYPE "public"."crawl_status" AS ENUM('pending', 'queued', 'crawling', 'scoring', 'complete', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('technical', 'content', 'ai_readiness', 'performance', 'schema', 'llm_visibility');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."llm_provider" AS ENUM('chatgpt', 'claude', 'perplexity', 'gemini', 'copilot');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'pro', 'agency');--> statement-breakpoint
CREATE TABLE "crawl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "crawl_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb NOT NULL,
	"pages_found" integer DEFAULT 0,
	"pages_crawled" integer DEFAULT 0,
	"pages_scored" integer DEFAULT 0,
	"error_message" text,
	"r2_prefix" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"category" "issue_category" NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"recommendation" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"overall_score" real NOT NULL,
	"technical_score" real,
	"content_score" real,
	"ai_readiness_score" real,
	"lighthouse_perf" real,
	"lighthouse_seo" real,
	"detail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"status_code" integer,
	"title" text,
	"meta_desc" text,
	"content_hash" text,
	"word_count" integer,
	"r2_raw_key" text,
	"r2_lh_key" text,
	"crawled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_sub_id" text,
	"crawl_credits_remaining" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visibility_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"llm_provider" "llm_provider" NOT NULL,
	"query" text NOT NULL,
	"response_text" text,
	"brand_mentioned" boolean DEFAULT false,
	"url_cited" boolean DEFAULT false,
	"citation_position" integer,
	"competitor_mentions" jsonb,
	"r2_response_key" text,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_scores" ADD CONSTRAINT "page_scores_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_scores" ADD CONSTRAINT "page_scores_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_project" ON "crawl_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "crawl_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_issues_page" ON "issues" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_issues_severity" ON "issues" USING btree ("job_id","severity");--> statement-breakpoint
CREATE INDEX "idx_pages_job" ON "pages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_pages_url" ON "pages" USING btree ("project_id","url");--> statement-breakpoint
CREATE INDEX "idx_projects_user" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vis_project" ON "visibility_checks" USING btree ("project_id","checked_at");