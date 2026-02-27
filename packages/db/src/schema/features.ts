import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  llmProviderEnum,
  integrationProviderEnum,
  eventStatusEnum,
  pipelineStatusEnum,
  channelTypeEnum,
  scheduleFrequencyEnum,
  fixTypeEnum,
  fixStatusEnum,
  narrativeToneEnum,
  narrativeStatusEnum,
  reportTypeEnum,
  reportFormatEnum,
  reportStatusEnum,
  alertSeverityEnum,
  competitorEventTypeEnum,
} from "./enums";
import { users } from "./identity";
import { projects, savedKeywords } from "./projects";
import { crawlJobs, pages } from "./crawling";

export const visibilityChecks = pgTable(
  "visibility_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    llmProvider: llmProviderEnum("llm_provider").notNull(),
    query: text("query").notNull(),
    responseText: text("response_text"),
    brandMentioned: boolean("brand_mentioned").default(false),
    urlCited: boolean("url_cited").default(false),
    citationPosition: integer("citation_position"),
    citedUrl: text("cited_url"),
    sentiment: text("sentiment"),
    brandDescription: text("brand_description"),
    competitorMentions: jsonb("competitor_mentions"),
    region: text("region").default("us"),
    language: text("language").default("en"),
    r2ResponseKey: text("r2_response_key"),
    keywordId: uuid("keyword_id").references(() => savedKeywords.id, {
      onDelete: "set null",
    }),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (t) => [index("idx_vis_project").on(t.projectId, t.checkedAt)],
);

export const competitorBenchmarks = pgTable(
  "competitor_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    competitorDomain: text("competitor_domain").notNull(),
    overallScore: real("overall_score"),
    technicalScore: real("technical_score"),
    contentScore: real("content_score"),
    aiReadinessScore: real("ai_readiness_score"),
    performanceScore: real("performance_score"),
    llmsTxtScore: real("llms_txt_score"),
    robotsTxtScore: real("robots_txt_score"),
    sitemapScore: real("sitemap_score"),
    schemaMarkupScore: real("schema_markup_score"),
    metaTagsScore: real("meta_tags_score"),
    botAccessScore: real("bot_access_score"),
    contentCiteabilityScore: real("content_citeability_score"),
    letterGrade: text("letter_grade"),
    issueCount: integer("issue_count").default(0),
    topIssues: jsonb("top_issues").default([]),
    crawledAt: timestamp("crawled_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_comp_benchmarks_project").on(t.projectId),
    index("idx_comp_benchmarks_domain").on(t.projectId, t.competitorDomain),
  ],
);

export const competitorEvents = pgTable(
  "competitor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    competitorDomain: text("competitor_domain").notNull(),
    eventType: competitorEventTypeEnum("event_type").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    summary: text("summary").notNull(),
    data: jsonb("data").default({}),
    benchmarkId: uuid("benchmark_id").references(
      () => competitorBenchmarks.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_competitor_events_feed").on(t.projectId, t.createdAt),
    index("idx_competitor_events_domain").on(
      t.projectId,
      t.competitorDomain,
      t.createdAt,
    ),
  ],
);

export const projectIntegrations = pgTable(
  "project_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    encryptedCredentials: text("encrypted_credentials"),
    config: jsonb("config").default({}),
    tokenExpiresAt: timestamp("token_expires_at"),
    lastSyncAt: timestamp("last_sync_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_proj_integrations_project").on(t.projectId),
    uniqueIndex("idx_proj_integrations_unique").on(t.projectId, t.provider),
  ],
);

export const pageEnrichments = pgTable(
  "page_enrichments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_enrichments_page").on(t.pageId),
    index("idx_enrichments_job_provider").on(t.jobId, t.provider),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    eventType: text("event_type"),
    payload: jsonb("payload").notNull(),
    status: eventStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    projectId: uuid("project_id"),
    userId: text("user_id"),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_outbox_status_available").on(t.status, t.availableAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    crawlJobId: uuid("crawl_job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reportTypeEnum("type").notNull(),
    format: reportFormatEnum("format").notNull(),
    status: reportStatusEnum("status").notNull().default("queued"),
    r2Key: text("r2_key"),
    fileSize: integer("file_size"),
    config: jsonb("config").default({}),
    error: text("error"),
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_reports_project").on(t.projectId),
    index("idx_reports_user").on(t.userId),
  ],
);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  reportToken: text("report_token"),
  source: text("source").notNull().default("shared_report"),
  scanResultId: uuid("scan_result_id"),
  convertedAt: timestamp("converted_at"),
  projectId: uuid("project_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    channelType: channelTypeEnum("channel_type").notNull(),
    config: jsonb("config").notNull().default({}),
    eventTypes: text("event_types").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_notif_channels_user").on(t.userId)],
);

export const scheduledVisibilityQueries = pgTable(
  "scheduled_visibility_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    providers: text("providers").array().notNull(),
    frequency: scheduleFrequencyEnum("frequency").notNull(),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_sched_vis_project").on(t.projectId),
    index("idx_sched_vis_next_run").on(t.nextRunAt, t.enabled),
  ],
);

export const scanResults = pgTable(
  "scan_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    url: text("url").notNull(),
    scores: jsonb("scores").notNull(),
    issues: jsonb("issues").notNull(),
    quickWins: jsonb("quick_wins").notNull(),
    siteContext: jsonb("site_context"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("idx_scan_results_expires").on(t.expiresAt)],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull().default("api"),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_api_tokens_user").on(t.userId),
    uniqueIndex("idx_api_tokens_hash").on(t.tokenHash),
  ],
);

export const contentFixes = pgTable(
  "content_fixes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, {
      onDelete: "cascade",
    }),
    issueCode: varchar("issue_code", { length: 64 }).notNull(),
    fixType: fixTypeEnum("fix_type").notNull(),
    originalContent: text("original_content"),
    generatedFix: text("generated_fix").notNull(),
    status: fixStatusEnum("status").notNull().default("generated"),
    tokensUsed: integer("tokens_used"),
    model: varchar("model", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_content_fixes_user").on(t.userId),
    index("idx_content_fixes_project").on(t.projectId),
    index("idx_content_fixes_page").on(t.pageId),
  ],
);

export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    format: reportFormatEnum("format").notNull().default("pdf"),
    type: reportTypeEnum("type").notNull().default("summary"),
    recipientEmail: text("recipient_email").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_report_schedules_project").on(t.projectId)],
);

export const narrativeReports = pgTable(
  "narrative_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlJobId: uuid("crawl_job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tone: narrativeToneEnum("tone").notNull(),
    status: narrativeStatusEnum("status").notNull().default("pending"),
    sections: jsonb("sections").default([]),
    version: integer("version").notNull().default(1),
    generatedBy: text("generated_by"),
    tokenUsage: jsonb("token_usage"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_narrative_reports_crawl").on(t.crawlJobId),
    index("idx_narrative_reports_project").on(t.projectId),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").default({}),
    acknowledgedAt: timestamp("acknowledged_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_alerts_project").on(t.projectId),
    index("idx_alerts_unacked").on(t.projectId, t.acknowledgedAt),
  ],
);

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    crawlJobId: uuid("crawl_job_id").references(() => crawlJobs.id),
    status: pipelineStatusEnum("status").default("pending").notNull(),
    currentStep: text("current_step"),
    stepResults: jsonb("step_results").default({}),
    settings: jsonb("settings").default({}),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_pipeline_runs_project").on(t.projectId),
    index("idx_pipeline_runs_crawl_job").on(t.crawlJobId),
  ],
);

export const logUploads = pgTable(
  "log_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    totalRequests: integer("total_requests").notNull().default(0),
    crawlerRequests: integer("crawler_requests").notNull().default(0),
    uniqueIPs: integer("unique_ips").notNull().default(0),
    summary: jsonb("summary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_log_uploads_project").on(t.projectId)],
);

export const brandSentimentSnapshots = pgTable(
  "brand_sentiment_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    overallSentiment: text("overall_sentiment"),
    sentimentScore: real("sentiment_score"),
    keyAttributes: jsonb("key_attributes"),
    brandNarrative: text("brand_narrative"),
    strengthTopics: jsonb("strength_topics"),
    weaknessTopics: jsonb("weakness_topics"),
    providerBreakdown: jsonb("provider_breakdown"),
    sampleSize: integer("sample_size").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_sentiment_project_period").on(t.projectId, t.period)],
);

export const aiPrompts = pgTable(
  "ai_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    category: text("category"),
    estimatedVolume: integer("estimated_volume"),
    difficulty: real("difficulty"),
    intent: text("intent"),
    yourMentioned: boolean("your_mentioned").default(false),
    competitorsMentioned: jsonb("competitors_mentioned"),
    source: text("source").notNull().default("discovered"),
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  },
  (t) => [index("idx_prompts_project").on(t.projectId)],
);
