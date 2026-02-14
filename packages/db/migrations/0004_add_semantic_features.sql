CREATE TYPE "public"."fact_type" AS ENUM('metric', 'definition', 'claim', 'quote');

CREATE TABLE IF NOT EXISTS "page_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" "public"."fact_type" NOT NULL,
	"content" text NOT NULL,
	"source_sentence" text,
	"citability_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "page_facts" ADD CONSTRAINT "page_facts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_facts_page" ON "page_facts" ("page_id");
