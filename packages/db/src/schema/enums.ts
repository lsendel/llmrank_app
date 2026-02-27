import { pgEnum } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);

export const crawlStatusEnum = pgEnum("crawl_status", [
  "pending",
  "queued",
  "crawling",
  "scoring",
  "complete",
  "failed",
  "cancelled",
]);

export const issueCategoryEnum = pgEnum("issue_category", [
  "technical",
  "content",
  "ai_readiness",
  "performance",
  "schema",
  "llm_visibility",
]);

export const issueSeverityEnum = pgEnum("issue_severity", [
  "critical",
  "warning",
  "info",
]);

export const insightCategoryEnum = pgEnum("insight_category", [
  "summary",
  "issue",
  "content",
  "ai_readiness",
  "performance",
  "visibility",
  "competitor",
  "platform",
]);

export const crawlScheduleEnum = pgEnum("crawl_schedule", [
  "manual",
  "daily",
  "weekly",
  "monthly",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "gemini_ai_mode",
  "grok",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "pending",
  "failed",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "gsc",
  "psi",
  "ga4",
  "clarity",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const pipelineStatusEnum = pgEnum("pipeline_status", [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "email",
  "webhook",
  "slack_incoming",
  "slack_app",
]);

export const scheduleFrequencyEnum = pgEnum("schedule_frequency", [
  "hourly",
  "daily",
  "weekly",
]);

export const personaEnum = pgEnum("persona", [
  "agency",
  "freelancer",
  "in_house",
  "developer",
]);

export const fixTypeEnum = pgEnum("fix_type", [
  "meta_description",
  "title_tag",
  "json_ld",
  "llms_txt",
  "faq_section",
  "summary_section",
  "alt_text",
  "og_tags",
  "canonical",
  "heading_structure",
  "robots_txt",
]);

export const fixStatusEnum = pgEnum("fix_status", [
  "generated",
  "applied",
  "dismissed",
]);

export const shareLevelEnum = pgEnum("share_level", [
  "summary",
  "issues",
  "full",
]);

export const funnelStageEnum = pgEnum("funnel_stage", [
  "education",
  "comparison",
  "purchase",
]);

export const keywordSourceEnum = pgEnum("keyword_source", [
  "auto_discovered",
  "user_added",
  "perplexity",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "percent_off",
  "amount_off",
  "free_months",
]);

export const promoDurationEnum = pgEnum("promo_duration", [
  "once",
  "repeating",
  "forever",
]);

export const narrativeToneEnum = pgEnum("narrative_tone", [
  "technical",
  "business",
]);

export const narrativeStatusEnum = pgEnum("narrative_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const reportTypeEnum = pgEnum("report_type", ["summary", "detailed"]);

export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx"]);

export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "generating",
  "complete",
  "failed",
]);

export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "critical",
  "warning",
  "info",
]);

export const competitorEventTypeEnum = pgEnum("competitor_event_type", [
  "score_change",
  "score_regression",
  "score_improvement",
  "llms_txt_added",
  "llms_txt_removed",
  "ai_crawlers_blocked",
  "ai_crawlers_unblocked",
  "schema_added",
  "schema_removed",
  "sitemap_added",
  "sitemap_removed",
  "new_pages_detected",
]);

export const monitoringFrequencyEnum = pgEnum("monitoring_frequency", [
  "daily",
  "weekly",
  "monthly",
  "off",
]);
