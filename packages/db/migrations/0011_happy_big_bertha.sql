CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."competitor_event_type" AS ENUM('score_change', 'score_regression', 'score_improvement', 'llms_txt_added', 'llms_txt_removed', 'ai_crawlers_blocked', 'ai_crawlers_unblocked', 'schema_added', 'schema_removed', 'sitemap_added', 'sitemap_removed', 'new_pages_detected');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent_off', 'amount_off', 'free_months');--> statement-breakpoint
CREATE TYPE "public"."funnel_stage" AS ENUM('education', 'comparison', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."keyword_source" AS ENUM('auto_discovered', 'user_added', 'perplexity');--> statement-breakpoint
CREATE TYPE "public"."monitoring_frequency" AS ENUM('daily', 'weekly', 'monthly', 'off');--> statement-breakpoint
CREATE TYPE "public"."narrative_status" AS ENUM('pending', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."narrative_tone" AS ENUM('technical', 'business');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('pending', 'running', 'paused', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."promo_duration" AS ENUM('once', 'repeating', 'forever');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
ALTER TYPE "public"."llm_provider" ADD VALUE 'gemini_ai_mode';--> statement-breakpoint
ALTER TYPE "public"."llm_provider" ADD VALUE 'grok';--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"job_to_be_done" text,
	"constraints" text,
	"success_metrics" text,
	"decision_criteria" text,
	"vocabulary" text[] DEFAULT '{}',
	"sample_queries" text[] DEFAULT '{}',
	"funnel_stage" "funnel_stage" DEFAULT 'education' NOT NULL,
	"avatar_url" text,
	"is_auto_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"source" "keyword_source" DEFAULT 'user_added' NOT NULL,
	"relevance_score" real,
	"funnel_stage" "funnel_stage",
	"persona_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"target_url" text NOT NULL,
	"target_domain" text NOT NULL,
	"anchor_text" text,
	"rel" text DEFAULT 'dofollow' NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"stripe_coupon_id" text NOT NULL,
	"stripe_promotion_code_id" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"duration" "promo_duration" NOT NULL,
	"duration_months" integer,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"category" text,
	"estimated_volume" integer,
	"difficulty" real,
	"intent" text,
	"your_mentioned" boolean DEFAULT false,
	"competitors_mentioned" jsonb,
	"source" text DEFAULT 'discovered' NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_sentiment_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"period" text NOT NULL,
	"overall_sentiment" text,
	"sentiment_score" real,
	"key_attributes" jsonb,
	"brand_narrative" text,
	"strength_topics" jsonb,
	"weakness_topics" jsonb,
	"provider_breakdown" jsonb,
	"sample_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"competitor_domain" text NOT NULL,
	"event_type" "competitor_event_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"summary" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"benchmark_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_monitoring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"query" text NOT NULL,
	"providers" text[] NOT NULL,
	"frequency" "schedule_frequency" DEFAULT 'weekly' NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrative_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_job_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"tone" "narrative_tone" NOT NULL,
	"status" "narrative_status" DEFAULT 'pending' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_by" text,
	"token_usage" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"crawl_job_id" uuid,
	"status" "pipeline_status" DEFAULT 'pending' NOT NULL,
	"current_step" text,
	"step_results" jsonb DEFAULT '{}'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"reason" text,
	"blocked_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "type" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "source" text DEFAULT 'user_added' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "monitoring_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "monitoring_frequency" "monitoring_frequency" DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "next_benchmark_at" timestamp;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "last_benchmark_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pipeline_settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_description_source" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "industry_source" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "cited_url" text;--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "brand_description" text;--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "region" text DEFAULT 'us';--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "language" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD COLUMN "keyword_id" uuid;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_keywords" ADD CONSTRAINT "saved_keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_keywords" ADD CONSTRAINT "saved_keywords_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promos" ADD CONSTRAINT "promos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sentiment_snapshots" ADD CONSTRAINT "brand_sentiment_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_events" ADD CONSTRAINT "competitor_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_events" ADD CONSTRAINT "competitor_events_benchmark_id_competitor_benchmarks_id_fk" FOREIGN KEY ("benchmark_id") REFERENCES "public"."competitor_benchmarks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_monitoring_schedules" ADD CONSTRAINT "competitor_monitoring_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_reports" ADD CONSTRAINT "narrative_reports_crawl_job_id_crawl_jobs_id_fk" FOREIGN KEY ("crawl_job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_reports" ADD CONSTRAINT "narrative_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_crawl_job_id_crawl_jobs_id_fk" FOREIGN KEY ("crawl_job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_domains" ADD CONSTRAINT "blocked_domains_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_personas_project" ON "personas" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_saved_keywords_project" ON "saved_keywords" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_saved_keywords_persona" ON "saved_keywords" USING btree ("persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_discovered_links_unique" ON "discovered_links" USING btree ("source_url","target_url");--> statement-breakpoint
CREATE INDEX "idx_discovered_links_target" ON "discovered_links" USING btree ("target_domain","discovered_at");--> statement-breakpoint
CREATE INDEX "idx_discovered_links_source" ON "discovered_links" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "idx_promos_code" ON "promos" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_promos_active" ON "promos" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_prompts_project" ON "ai_prompts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_project" ON "alerts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_unacked" ON "alerts" USING btree ("project_id","acknowledged_at");--> statement-breakpoint
CREATE INDEX "idx_sentiment_project_period" ON "brand_sentiment_snapshots" USING btree ("project_id","period");--> statement-breakpoint
CREATE INDEX "idx_competitor_events_feed" ON "competitor_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_competitor_events_domain" ON "competitor_events" USING btree ("project_id","competitor_domain","created_at");--> statement-breakpoint
CREATE INDEX "idx_comp_mon_schedules_project" ON "competitor_monitoring_schedules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_comp_mon_schedules_due" ON "competitor_monitoring_schedules" USING btree ("next_run_at","enabled");--> statement-breakpoint
CREATE INDEX "idx_narrative_reports_crawl" ON "narrative_reports" USING btree ("crawl_job_id");--> statement-breakpoint
CREATE INDEX "idx_narrative_reports_project" ON "narrative_reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_project" ON "pipeline_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_crawl_job" ON "pipeline_runs" USING btree ("crawl_job_id");--> statement-breakpoint
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_keyword_id_saved_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."saved_keywords"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitors_next_benchmark" ON "competitors" USING btree ("next_benchmark_at","monitoring_enabled");