CREATE TYPE "public"."event_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fact_type" AS ENUM('metric', 'definition', 'claim', 'quote');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" "fact_type" NOT NULL,
	"content" text NOT NULL,
	"source_sentence" text,
	"citability_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "branding" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_facts" ADD CONSTRAINT "page_facts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_target" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_competitors_project" ON "competitors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_status_available" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "idx_facts_page" ON "page_facts" USING btree ("page_id");--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scores_job" ON "page_scores" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_scores_page" ON "page_scores" USING btree ("page_id");