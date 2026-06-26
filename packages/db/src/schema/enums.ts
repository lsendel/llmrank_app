export const PLAN_VALUES = ["free", "starter", "pro", "agency"] as const;
export type Plan = (typeof PLAN_VALUES)[number];

export const USER_STATUS_VALUES = ["active", "suspended", "banned"] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];

export const CRAWL_STATUS_VALUES = [
  "pending",
  "queued",
  "crawling",
  "scoring",
  "complete",
  "failed",
  "cancelled",
] as const;
export type CrawlStatus = (typeof CRAWL_STATUS_VALUES)[number];

export const ISSUE_CATEGORY_VALUES = [
  "technical",
  "content",
  "ai_readiness",
  "performance",
  "schema",
  "llm_visibility",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORY_VALUES)[number];

export const ISSUE_SEVERITY_VALUES = ["critical", "warning", "info"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITY_VALUES)[number];

export const INSIGHT_CATEGORY_VALUES = [
  "summary",
  "issue",
  "content",
  "ai_readiness",
  "performance",
  "visibility",
  "competitor",
  "platform",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORY_VALUES)[number];

export const CRAWL_SCHEDULE_VALUES = [
  "manual",
  "daily",
  "weekly",
  "monthly",
] as const;
export type CrawlSchedule = (typeof CRAWL_SCHEDULE_VALUES)[number];

export const LLM_PROVIDER_VALUES = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "gemini_ai_mode",
  "grok",
] as const;
export type LlmProvider = (typeof LLM_PROVIDER_VALUES)[number];

export const SUBSCRIPTION_STATUS_VALUES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = [
  "succeeded",
  "pending",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const INTEGRATION_PROVIDER_VALUES = [
  "gsc",
  "psi",
  "ga4",
  "clarity",
  "meta",
  "cloudflare",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDER_VALUES)[number];

export const EVENT_STATUS_VALUES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type EventStatus = (typeof EVENT_STATUS_VALUES)[number];

export const PIPELINE_STATUS_VALUES = [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUS_VALUES)[number];

export const CHANNEL_TYPE_VALUES = [
  "email",
  "webhook",
  "slack_incoming",
  "slack_app",
] as const;
export type ChannelType = (typeof CHANNEL_TYPE_VALUES)[number];

export const SCHEDULE_FREQUENCY_VALUES = ["hourly", "daily", "weekly"] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCY_VALUES)[number];

export const PERSONA_VALUES = [
  "agency",
  "freelancer",
  "in_house",
  "developer",
] as const;
export type Persona = (typeof PERSONA_VALUES)[number];

export const FIX_TYPE_VALUES = [
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
] as const;
export type FixType = (typeof FIX_TYPE_VALUES)[number];

export const FIX_STATUS_VALUES = ["generated", "applied", "dismissed"] as const;
export type FixStatus = (typeof FIX_STATUS_VALUES)[number];

export const SHARE_LEVEL_VALUES = ["summary", "issues", "full"] as const;
export type ShareLevel = (typeof SHARE_LEVEL_VALUES)[number];

export const FUNNEL_STAGE_VALUES = [
  "education",
  "comparison",
  "purchase",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGE_VALUES)[number];

export const KEYWORD_SOURCE_VALUES = [
  "auto_discovered",
  "user_added",
  "perplexity",
] as const;
export type KeywordSource = (typeof KEYWORD_SOURCE_VALUES)[number];

export const DISCOUNT_TYPE_VALUES = [
  "percent_off",
  "amount_off",
  "free_months",
] as const;
export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number];

export const PROMO_DURATION_VALUES = ["once", "repeating", "forever"] as const;
export type PromoDuration = (typeof PROMO_DURATION_VALUES)[number];

export const NARRATIVE_TONE_VALUES = ["technical", "business"] as const;
export type NarrativeTone = (typeof NARRATIVE_TONE_VALUES)[number];

export const NARRATIVE_STATUS_VALUES = [
  "pending",
  "generating",
  "ready",
  "failed",
] as const;
export type NarrativeStatus = (typeof NARRATIVE_STATUS_VALUES)[number];

export const REPORT_TYPE_VALUES = ["summary", "detailed"] as const;
export type ReportType = (typeof REPORT_TYPE_VALUES)[number];

export const REPORT_FORMAT_VALUES = ["pdf", "docx"] as const;
export type ReportFormat = (typeof REPORT_FORMAT_VALUES)[number];

export const REPORT_STATUS_VALUES = [
  "queued",
  "generating",
  "complete",
  "failed",
] as const;
export type ReportStatus = (typeof REPORT_STATUS_VALUES)[number];

export const ORG_ROLE_VALUES = ["owner", "admin", "member", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLE_VALUES)[number];

export const TEAM_ROLE_VALUES = ["owner", "admin", "editor", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLE_VALUES)[number];

export const ALERT_SEVERITY_VALUES = ["critical", "warning", "info"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITY_VALUES)[number];

export const COMPETITOR_EVENT_TYPE_VALUES = [
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
] as const;
export type CompetitorEventType = (typeof COMPETITOR_EVENT_TYPE_VALUES)[number];

export const MONITORING_FREQUENCY_VALUES = [
  "daily",
  "weekly",
  "monthly",
  "off",
] as const;
export type MonitoringFrequency = (typeof MONITORING_FREQUENCY_VALUES)[number];

export const SOURCE_TYPE_VALUES = [
  "organic",
  "ai_referral",
  "ai_bot",
  "direct",
  "social",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];

export const PROMPT_STATUS_VALUES = ["draft", "active", "archived"] as const;
export type PromptStatus = (typeof PROMPT_STATUS_VALUES)[number];
