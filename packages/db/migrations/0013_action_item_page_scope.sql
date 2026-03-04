ALTER TABLE "action_items"
ADD COLUMN "page_id" uuid;
--> statement-breakpoint
ALTER TABLE "action_items"
ADD CONSTRAINT "action_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_action_items_page" ON "action_items" USING btree ("page_id");
--> statement-breakpoint
CREATE INDEX "idx_action_items_issue_page" ON "action_items" USING btree ("project_id","issue_code","page_id");
