CREATE TYPE "public"."channel_type" AS ENUM('email', 'webhook', 'slack_incoming', 'slack_app');--> statement-breakpoint
CREATE TYPE "public"."fix_status" AS ENUM('generated', 'applied', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."fix_type" AS ENUM('meta_description', 'title_tag', 'json_ld', 'llms_txt', 'faq_section', 'summary_section', 'alt_text', 'og_tags', 'canonical', 'heading_structure');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('hourly', 'daily', 'weekly');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" text[] NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"competitor_domain" text NOT NULL,
	"overall_score" real,
	"technical_score" real,
	"content_score" real,
	"ai_readiness_score" real,
	"performance_score" real,
	"letter_grade" text,
	"issue_count" integer DEFAULT 0,
	"top_issues" jsonb DEFAULT '[]'::jsonb,
	"crawled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_fixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid,
	"issue_code" varchar(64) NOT NULL,
	"fix_type" "fix_type" NOT NULL,
	"original_content" text,
	"generated_fix" text NOT NULL,
	"status" "fix_status" DEFAULT 'generated' NOT NULL,
	"tokens_used" integer,
	"model" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"report_token" text,
	"source" text DEFAULT 'shared_report' NOT NULL,
	"scan_result_id" uuid,
	"converted_at" timestamp,
	"project_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"channel_type" "channel_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"event_types" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"url" text NOT NULL,
	"scores" jsonb NOT NULL,
	"issues" jsonb NOT NULL,
	"quick_wins" jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_visibility_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"query" text NOT NULL,
	"providers" text[] NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_frequency" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_digest_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD CONSTRAINT "competitor_benchmarks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_fixes" ADD CONSTRAINT "content_fixes_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_visibility_queries" ADD CONSTRAINT "scheduled_visibility_queries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_tokens_user" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_tokens_hash" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_comp_benchmarks_project" ON "competitor_benchmarks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_comp_benchmarks_domain" ON "competitor_benchmarks" USING btree ("project_id","competitor_domain");--> statement-breakpoint
CREATE INDEX "idx_content_fixes_user" ON "content_fixes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_content_fixes_project" ON "content_fixes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_content_fixes_page" ON "content_fixes" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_notif_channels_user" ON "notification_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scan_results_expires" ON "scan_results" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sched_vis_project" ON "scheduled_visibility_queries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sched_vis_next_run" ON "scheduled_visibility_queries" USING btree ("next_run_at","enabled");