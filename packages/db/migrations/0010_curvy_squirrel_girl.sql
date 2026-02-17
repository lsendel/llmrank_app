CREATE TYPE "public"."insight_category" AS ENUM('summary', 'issue', 'content', 'ai_readiness', 'performance', 'visibility', 'competitor', 'platform');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."persona" AS ENUM('agency', 'freelancer', 'in_house', 'developer');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
ALTER TYPE "public"."fix_type" ADD VALUE 'robots_txt';--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"category" "issue_category" NOT NULL,
	"score_impact" real DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" text,
	"verified_at" timestamp,
	"verified_by_crawl_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "insight_category" NOT NULL,
	"type" text NOT NULL,
	"severity" "issue_severity",
	"headline" text NOT NULL,
	"summary" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"invited_by" text,
	"invited_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"sso_enabled" boolean DEFAULT false NOT NULL,
	"sso_provider" text,
	"sso_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "page_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid,
	"url" text NOT NULL,
	"category" "insight_category" NOT NULL,
	"type" text NOT NULL,
	"severity" "issue_severity",
	"headline" text NOT NULL,
	"summary" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"type" "report_type" DEFAULT 'summary' NOT NULL,
	"recipient_email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"weights" jsonb NOT NULL,
	"disabled_factors" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" DEFAULT 'viewer' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" DEFAULT 'viewer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "llms_txt_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "robots_txt_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "sitemap_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "schema_markup_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "meta_tags_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "bot_access_score" real;--> statement-breakpoint
ALTER TABLE "competitor_benchmarks" ADD COLUMN "content_citeability_score" real;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "site_context" jsonb;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "llms_txt_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "robots_txt_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "sitemap_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "schema_markup_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "meta_tags_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "bot_access_score" real;--> statement-breakpoint
ALTER TABLE "page_scores" ADD COLUMN "content_citeability_score" real;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scoring_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "leaderboard_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_results" ADD COLUMN "site_context" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "persona" "persona";--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_verified_by_crawl_id_crawl_jobs_id_fk" FOREIGN KEY ("verified_by_crawl_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_insights" ADD CONSTRAINT "crawl_insights_crawl_id_crawl_jobs_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_insights" ADD CONSTRAINT "crawl_insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_insights" ADD CONSTRAINT "page_insights_crawl_id_crawl_jobs_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_insights" ADD CONSTRAINT "page_insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_insights" ADD CONSTRAINT "page_insights_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_profiles" ADD CONSTRAINT "scoring_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_action_items_project" ON "action_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_action_items_status" ON "action_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_crawl" ON "crawl_insights" USING btree ("crawl_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_project" ON "crawl_insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_type" ON "crawl_insights" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_org_invites_org" ON "org_invites" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_members_unique" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_page_insights_crawl" ON "page_insights" USING btree ("crawl_id");--> statement-breakpoint
CREATE INDEX "idx_page_insights_project" ON "page_insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_page_insights_page" ON "page_insights" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_project" ON "report_schedules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_scoring_profiles_user" ON "scoring_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_team" ON "team_invitations" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_team_members_unique" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_user" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id");