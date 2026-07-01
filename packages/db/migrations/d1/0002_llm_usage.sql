-- LLM cost tracking: one row per LLM API call (token usage + estimated cost).
-- Powers the admin spend view + per-account budget caps.
CREATE TABLE `llm_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`user_id` text,
	`feature` text NOT NULL,
	`model` text NOT NULL,
	`plan` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_llm_usage_created` ON `llm_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_user` ON `llm_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_project` ON `llm_usage` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_feature` ON `llm_usage` (`feature`);
