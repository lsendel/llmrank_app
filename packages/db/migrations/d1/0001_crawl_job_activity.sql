-- Crawler stall-recovery support for crawl_jobs.
--
-- updated_at: activity timestamp, bumped on every status/progress write so the
-- stall watchdog can detect a crawler that died mid-run by inactivity (minutes)
-- instead of age from createdAt (6h). SQLite forbids a non-constant default
-- (datetime('now')/CURRENT_TIMESTAMP) in ALTER TABLE ADD COLUMN, so it is added
-- nullable and backfilled from created_at; application code always sets it on
-- write, so no new NULLs are produced.
ALTER TABLE `crawl_jobs` ADD COLUMN `updated_at` text;--> statement-breakpoint
UPDATE `crawl_jobs` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
-- redispatch_count: number of times a stalled job was auto-re-dispatched. Bounds
-- the recovery loop (integer default is a valid constant for ADD COLUMN).
ALTER TABLE `crawl_jobs` ADD COLUMN `redispatch_count` integer DEFAULT 0 NOT NULL;
