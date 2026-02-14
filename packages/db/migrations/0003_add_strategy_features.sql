-- Add summary column to crawl_jobs
ALTER TABLE "crawl_jobs" ADD COLUMN "summary" text;

-- Add branding column to projects
ALTER TABLE "projects" ADD COLUMN "branding" jsonb DEFAULT '{}'::jsonb;

-- Create competitors table
CREATE TABLE IF NOT EXISTS "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add index for competitors
CREATE INDEX IF NOT EXISTS "idx_competitors_project" ON "competitors" ("project_id");

-- Add foreign key for competitors
DO $$ BEGIN
 ALTER TABLE "competitors" ADD CONSTRAINT "competitors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
