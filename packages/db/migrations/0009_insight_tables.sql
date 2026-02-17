CREATE TYPE "insight_category" AS ENUM (
  'summary',
  'issue',
  'content',
  'ai_readiness',
  'performance',
  'visibility',
  'competitor',
  'platform'
);
--> statement-breakpoint
CREATE TABLE "crawl_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "crawl_id" uuid NOT NULL REFERENCES "crawl_jobs"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "category" "insight_category" NOT NULL,
  "type" text NOT NULL,
  "severity" "issue_severity",
  "headline" text NOT NULL,
  "summary" text,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "crawl_id" uuid NOT NULL REFERENCES "crawl_jobs"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "page_id" uuid REFERENCES "pages"("id") ON DELETE cascade,
  "url" text NOT NULL,
  "category" "insight_category" NOT NULL,
  "type" text NOT NULL,
  "severity" "issue_severity",
  "headline" text NOT NULL,
  "summary" text,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_crawl" ON "crawl_insights" ("crawl_id");
--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_project" ON "crawl_insights" ("project_id");
--> statement-breakpoint
CREATE INDEX "idx_crawl_insights_type" ON "crawl_insights" ("type");
--> statement-breakpoint
CREATE INDEX "idx_page_insights_crawl" ON "page_insights" ("crawl_id");
--> statement-breakpoint
CREATE INDEX "idx_page_insights_project" ON "page_insights" ("project_id");
--> statement-breakpoint
CREATE INDEX "idx_page_insights_page" ON "page_insights" ("page_id");
