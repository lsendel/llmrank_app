ALTER TABLE crawl_jobs
  ADD COLUMN cancelled_at timestamp,
  ADD COLUMN cancelled_by uuid REFERENCES users(id),
  ADD COLUMN cancel_reason text;
