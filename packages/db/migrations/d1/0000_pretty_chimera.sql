CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_user_id` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text,
	`issue_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`score_impact` real DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assignee_id` text,
	`due_at` text,
	`verified_at` text,
	`verified_by_crawl_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_crawl_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_action_items_project` ON `action_items` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_action_items_page` ON `action_items` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_action_items_status` ON `action_items` (`status`);--> statement-breakpoint
CREATE INDEX `idx_action_items_issue_page` ON `action_items` (`project_id`,`issue_code`,`page_id`);--> statement-breakpoint
CREATE TABLE `ai_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`prompt` text NOT NULL,
	`category` text,
	`estimated_volume` integer,
	`difficulty` real,
	`intent` text,
	`your_mentioned` integer DEFAULT false,
	`competitors_mentioned` text,
	`source` text DEFAULT 'discovered' NOT NULL,
	`discovered_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_prompts_project` ON `ai_prompts` (`project_id`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`data` text DEFAULT '{}',
	`acknowledged_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_project` ON `alerts` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_alerts_unacked` ON `alerts` (`project_id`,`acknowledged_at`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`type` text DEFAULT 'api' NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_tokens_user` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_tokens_hash` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`source` text DEFAULT 'user_added' NOT NULL,
	`monitoring_enabled` integer DEFAULT true NOT NULL,
	`monitoring_frequency` text DEFAULT 'weekly' NOT NULL,
	`next_benchmark_at` text,
	`last_benchmark_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_competitors_project` ON `competitors` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_competitors_next_benchmark` ON `competitors` (`next_benchmark_at`,`monitoring_enabled`);--> statement-breakpoint
CREATE TABLE `content_fixes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text,
	`issue_code` text NOT NULL,
	`fix_type` text NOT NULL,
	`original_content` text,
	`generated_fix` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`tokens_used` integer,
	`model` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_content_fixes_user` ON `content_fixes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_content_fixes_project` ON `content_fixes` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_content_fixes_page` ON `content_fixes` (`page_id`);--> statement-breakpoint
CREATE TABLE `crawl_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`crawl_id` text NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`severity` text,
	`headline` text NOT NULL,
	`summary` text,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`crawl_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_crawl_insights_crawl` ON `crawl_insights` (`crawl_id`);--> statement-breakpoint
CREATE INDEX `idx_crawl_insights_project` ON `crawl_insights` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_crawl_insights_type` ON `crawl_insights` (`type`);--> statement-breakpoint
CREATE TABLE `crawl_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`config` text NOT NULL,
	`pages_found` integer DEFAULT 0,
	`pages_crawled` integer DEFAULT 0,
	`pages_scored` integer DEFAULT 0,
	`error_message` text,
	`r2_prefix` text,
	`summary` text,
	`summary_data` text,
	`site_context` text,
	`share_token` text,
	`share_enabled` integer DEFAULT false,
	`shared_at` text,
	`share_level` text DEFAULT 'summary',
	`share_expires_at` text,
	`started_at` text,
	`completed_at` text,
	`cancelled_at` text,
	`cancelled_by` text,
	`cancel_reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_jobs_share_token_unique` ON `crawl_jobs` (`share_token`);--> statement-breakpoint
CREATE INDEX `idx_jobs_project` ON `crawl_jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `crawl_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_share_token` ON `crawl_jobs` (`share_token`);--> statement-breakpoint
CREATE INDEX `idx_jobs_project_status_created` ON `crawl_jobs` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_extractors` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`selector` text NOT NULL,
	`attribute` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_extractors_project` ON `custom_extractors` (`project_id`);--> statement-breakpoint
CREATE TABLE `discovered_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`source_domain` text NOT NULL,
	`target_url` text NOT NULL,
	`target_domain` text NOT NULL,
	`anchor_text` text,
	`rel` text DEFAULT 'dofollow' NOT NULL,
	`discovered_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_discovered_links_unique` ON `discovered_links` (`source_url`,`target_url`);--> statement-breakpoint
CREATE INDEX `idx_discovered_links_target` ON `discovered_links` (`target_domain`,`discovered_at`);--> statement-breakpoint
CREATE INDEX `idx_discovered_links_source` ON `discovered_links` (`source_domain`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`job_id` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`recommendation` text,
	`data` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_issues_page` ON `issues` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_issues_severity` ON `issues` (`job_id`,`severity`);--> statement-breakpoint
CREATE INDEX `idx_issues_job_code` ON `issues` (`job_id`,`code`);--> statement-breakpoint
CREATE TABLE `log_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`total_requests` integer DEFAULT 0 NOT NULL,
	`crawler_requests` integer DEFAULT 0 NOT NULL,
	`unique_ips` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_log_uploads_project` ON `log_uploads` (`project_id`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`channel_type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`event_types` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notif_channels_user` ON `notification_channels` (`user_id`);--> statement-breakpoint
CREATE TABLE `org_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_invites_token_unique` ON `org_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_org_invites_org` ON `org_invites` (`org_id`);--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invited_by` text,
	`invited_at` text,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_org_members_unique` ON `org_members` (`org_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_org_members_user` ON `org_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`settings` text DEFAULT '{}',
	`sso_enabled` integer DEFAULT false NOT NULL,
	`sso_provider` text,
	`sso_config` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organizations_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`event_type` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`project_id` text,
	`user_id` text,
	`available_at` text DEFAULT (datetime('now')) NOT NULL,
	`processed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_status_available` ON `outbox_events` (`status`,`available_at`);--> statement-breakpoint
CREATE TABLE `page_enrichments` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`job_id` text NOT NULL,
	`provider` text NOT NULL,
	`data` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_enrichments_page` ON `page_enrichments` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_enrichments_job_provider` ON `page_enrichments` (`job_id`,`provider`);--> statement-breakpoint
CREATE TABLE `page_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`crawl_id` text NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`severity` text,
	`headline` text NOT NULL,
	`summary` text,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`crawl_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_page_insights_crawl` ON `page_insights` (`crawl_id`);--> statement-breakpoint
CREATE INDEX `idx_page_insights_project` ON `page_insights` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_page_insights_page` ON `page_insights` (`page_id`);--> statement-breakpoint
CREATE TABLE `page_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`job_id` text NOT NULL,
	`overall_score` real NOT NULL,
	`technical_score` real,
	`content_score` real,
	`ai_readiness_score` real,
	`llms_txt_score` real,
	`robots_txt_score` real,
	`sitemap_score` real,
	`schema_markup_score` real,
	`meta_tags_score` real,
	`bot_access_score` real,
	`content_citeability_score` real,
	`lighthouse_perf` real,
	`lighthouse_seo` real,
	`detail` text,
	`platform_scores` text,
	`recommendations` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scores_job` ON `page_scores` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_scores_page` ON `page_scores` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_scores_job_overall` ON `page_scores` (`job_id`,`overall_score`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`project_id` text NOT NULL,
	`url` text NOT NULL,
	`canonical_url` text,
	`status_code` integer,
	`title` text,
	`meta_desc` text,
	`content_hash` text,
	`word_count` integer,
	`content_type` text DEFAULT 'unknown',
	`text_length` integer,
	`html_length` integer,
	`r2_raw_key` text,
	`r2_lh_key` text,
	`crawled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pages_job` ON `pages` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_pages_url` ON `pages` (`project_id`,`url`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text,
	`stripe_invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`status` text DEFAULT 'succeeded' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_stripe_invoice_id_unique` ON `payments` (`stripe_invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_user` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_subscription` ON `payments` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`job_to_be_done` text,
	`constraints` text,
	`success_metrics` text,
	`decision_criteria` text,
	`vocabulary` text DEFAULT '[]',
	`sample_queries` text DEFAULT '[]',
	`funnel_stage` text DEFAULT 'education' NOT NULL,
	`avatar_url` text,
	`is_auto_generated` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_personas_project` ON `personas` (`project_id`);--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`crawl_job_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_step` text,
	`step_results` text DEFAULT '{}',
	`settings` text DEFAULT '{}',
	`started_at` text,
	`completed_at` text,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`crawl_job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pipeline_runs_project` ON `pipeline_runs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_pipeline_runs_crawl_job` ON `pipeline_runs` (`crawl_job_id`);--> statement-breakpoint
CREATE TABLE `plan_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_code` text NOT NULL,
	`old_price_cents` integer NOT NULL,
	`new_price_cents` integer NOT NULL,
	`changed_by` text,
	`reason` text,
	`changed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_price_history_plan` ON `plan_price_history` (`plan_code`);--> statement-breakpoint
CREATE TABLE `project_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`provider` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`encrypted_credentials` text,
	`config` text DEFAULT '{}',
	`token_expires_at` text,
	`last_sync_at` text,
	`last_error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_proj_integrations_project` ON `project_integrations` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_proj_integrations_unique` ON `project_integrations` (`project_id`,`provider`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`settings` text DEFAULT '{}',
	`branding` text DEFAULT '{}',
	`crawl_schedule` text DEFAULT 'manual' NOT NULL,
	`next_crawl_at` text,
	`scoring_profile_id` text,
	`leaderboard_opt_in` integer DEFAULT false NOT NULL,
	`team_id` text,
	`site_description` text,
	`industry` text,
	`pipeline_settings` text DEFAULT '{}',
	`site_description_source` text DEFAULT 'auto',
	`industry_source` text DEFAULT 'auto',
	`business_goal` text,
	`favicon_url` text,
	`analytics_snippet_enabled` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_projects_user` ON `projects` (`user_id`);--> statement-breakpoint
CREATE TABLE `promos` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`stripe_coupon_id` text NOT NULL,
	`stripe_promotion_code_id` text,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`duration` text NOT NULL,
	`duration_months` integer,
	`max_redemptions` integer,
	`times_redeemed` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promos_code_unique` ON `promos` (`code`);--> statement-breakpoint
CREATE INDEX `idx_promos_code` ON `promos` (`code`);--> statement-breakpoint
CREATE INDEX `idx_promos_active` ON `promos` (`active`);--> statement-breakpoint
CREATE TABLE `report_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`format` text DEFAULT 'pdf' NOT NULL,
	`type` text DEFAULT 'summary' NOT NULL,
	`recipient_email` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_schedules_project` ON `report_schedules` (`project_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`crawl_job_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`r2_key` text,
	`file_size` integer,
	`config` text DEFAULT '{}',
	`error` text,
	`generated_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`crawl_job_id`) REFERENCES `crawl_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reports_project` ON `reports` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_user` ON `reports` (`user_id`);--> statement-breakpoint
CREATE TABLE `saved_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`source` text DEFAULT 'user_added' NOT NULL,
	`relevance_score` real,
	`funnel_stage` text,
	`persona_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_saved_keywords_project` ON `saved_keywords` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_keywords_persona` ON `saved_keywords` (`persona_id`);--> statement-breakpoint
CREATE TABLE `scan_results` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`url` text NOT NULL,
	`scores` text NOT NULL,
	`issues` text NOT NULL,
	`quick_wins` text NOT NULL,
	`site_context` text,
	`ip_hash` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scan_results_expires` ON `scan_results` (`expires_at`);--> statement-breakpoint
CREATE TABLE `scheduled_visibility_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`query` text NOT NULL,
	`providers` text DEFAULT '[]' NOT NULL,
	`frequency` text NOT NULL,
	`last_run_at` text,
	`next_run_at` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sched_vis_project` ON `scheduled_visibility_queries` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_sched_vis_next_run` ON `scheduled_visibility_queries` (`next_run_at`,`enabled`);--> statement-breakpoint
CREATE TABLE `scoring_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`weights` text NOT NULL,
	`disabled_factors` text DEFAULT '[]',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scoring_profiles_user` ON `scoring_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`token` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`current_period_start` text,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`canceled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_id_unique` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_stripe` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_token_unique` ON `team_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_team` ON `team_invitations` (`team_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_members_unique` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_team_members_user` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`clerk_id` text,
	`name` text,
	`phone` text,
	`avatar_url` text,
	`image` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_sub_id` text,
	`crawl_credits_remaining` integer DEFAULT 100 NOT NULL,
	`notify_on_crawl_complete` integer DEFAULT true NOT NULL,
	`notify_on_score_drop` integer DEFAULT true NOT NULL,
	`webhook_url` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`suspended_at` text,
	`suspended_reason` text,
	`onboarding_complete` integer DEFAULT false NOT NULL,
	`persona` text,
	`digest_frequency` text DEFAULT 'off' NOT NULL,
	`digest_day` integer DEFAULT 1 NOT NULL,
	`last_digest_sent_at` text,
	`trial_started_at` text,
	`trial_ends_at` text,
	`last_signed_in` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_target` ON `admin_audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `admin_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '{}' NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`metadata` text DEFAULT '{}',
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_org_created` ON `audit_logs` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_resource` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `blocked_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`reason` text,
	`blocked_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`blocked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_domains_domain_unique` ON `blocked_domains` (`domain`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`report_token` text,
	`source` text DEFAULT 'shared_report' NOT NULL,
	`scan_result_id` text,
	`converted_at` text,
	`project_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`invocations` integer DEFAULT 0,
	`avg_latency_ms` integer,
	`avg_tokens_in` integer,
	`avg_tokens_out` integer,
	`avg_cost_cents` integer,
	`error_rate_bps` integer,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompt_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`user_prompt_template` text NOT NULL,
	`variables` text,
	`model` text NOT NULL,
	`model_config` text,
	`version` integer DEFAULT 1 NOT NULL,
	`content_hash` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`parent_id` text,
	`created_by` text,
	`activated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
