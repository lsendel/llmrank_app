/**
 * Supabase Agency Schema
 *
 * These tables STAY as PostgreSQL (pgTable) because they use complex PG queries
 * (jsonb_array_elements, array_agg, etc). They run on Supabase via Hyperdrive.
 *
 * IMPORTANT: All .references() foreign keys that point to tables in D1
 * (projects, crawlJobs, savedKeywords, users) have been removed.
 * Cross-database FKs cannot work. The columns are kept but without .references().
 *
 * pgEnum references replaced with plain text() columns.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Visibility Checks ────────────────────────────────────────────────────────

export const visibilityChecks = pgTable(
  "visibility_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    llmProvider: text("llm_provider").notNull(), // llmProviderEnum → text
    query: text("query").notNull(),
    responseText: text("response_text"),
    brandMentioned: boolean("brand_mentioned").default(false),
    urlCited: boolean("url_cited").default(false),
    citationPosition: integer("citation_position"),
    citedUrl: text("cited_url"),
    sentiment: text("sentiment"),
    brandDescription: text("brand_description"),
    competitorMentions: jsonb("competitor_mentions"),
    // Distinct source hosts the answer cited (brand, competitors, third parties)
    // — makes source-of-citation auditable. string[] stored as jsonb.
    citedSources: jsonb("cited_sources"),
    // How the provider answered: "live_retrieval" (web-grounded: Perplexity,
    // Copilot) vs "recall" (plain completion, citations may be hallucinated).
    engineMode: text("engine_mode"),
    region: text("region").default("us"),
    language: text("language").default("en"),
    r2ResponseKey: text("r2_response_key"),
    keywordId: uuid("keyword_id"), // no .references() — cross-DB FK
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_vis_project").on(t.projectId, t.checkedAt),
    index("idx_vis_brand_mentioned").on(t.projectId, t.brandMentioned),
  ],
);

// ─── Competitor Benchmarks ────────────────────────────────────────────────────

export const competitorBenchmarks = pgTable(
  "competitor_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
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

// ─── Competitor Events ────────────────────────────────────────────────────────

export const competitorEvents = pgTable(
  "competitor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    competitorDomain: text("competitor_domain").notNull(),
    eventType: text("event_type").notNull(), // competitorEventTypeEnum → text
    severity: text("severity").notNull(), // alertSeverityEnum → text
    summary: text("summary").notNull(),
    data: jsonb("data").default({}),
    benchmarkId: uuid("benchmark_id").references(
      () => competitorBenchmarks.id,
      { onDelete: "set null" },
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

// ─── Competitor Monitoring Schedules ──────────────────────────────────────────

export const competitorMonitoringSchedules = pgTable(
  "competitor_monitoring_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    query: text("query").notNull(),
    providers: text("providers").array().notNull(),
    frequency: text("frequency").notNull().default("weekly"), // scheduleFrequencyEnum → text
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_comp_mon_schedules_project").on(t.projectId),
    index("idx_comp_mon_schedules_due").on(t.nextRunAt, t.enabled),
  ],
);

// ─── Narrative Reports ────────────────────────────────────────────────────────

export const narrativeReports = pgTable(
  "narrative_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlJobId: uuid("crawl_job_id").notNull(), // no .references() — cross-DB FK
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    tone: text("tone").notNull(), // narrativeToneEnum → text
    status: text("status").notNull().default("pending"), // narrativeStatusEnum → text
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

// ─── Brand Sentiment Snapshots ────────────────────────────────────────────────

export const brandSentimentSnapshots = pgTable(
  "brand_sentiment_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
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

// ─── LLM Batch Jobs ───────────────────────────────────────────────────────────

export const llmBatchJobs = pgTable(
  "llm_batch_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: text("batch_id").notNull(),
    jobId: uuid("job_id").notNull(), // no .references() — cross-DB FK
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    status: text("status").notNull().default("submitted"),
    totalRequests: integer("total_requests").notNull().default(0),
    completedRequests: integer("completed_requests").notNull().default(0),
    failedRequests: integer("failed_requests").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    error: text("error"),
  },
  (t) => [
    index("idx_llm_batch_jobs_status").on(t.status),
    index("idx_llm_batch_jobs_job_id").on(t.jobId),
  ],
);

// ─── Analytics Events ─────────────────────────────────────────────────────────

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id"), // no .references() — cross-DB FK
    event: text("event").notNull(),
    domain: text("domain").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    sourceType: text("source_type").notNull().default("other"), // sourceTypeEnum → text
    aiProvider: text("ai_provider"),
    country: text("country"),
    botScore: integer("bot_score"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_analytics_events_project_created").on(t.projectId, t.createdAt),
    index("idx_analytics_events_source_created").on(t.sourceType, t.createdAt),
    index("idx_analytics_events_ai_provider_created").on(
      t.aiProvider,
      t.createdAt,
    ),
  ],
);

// ─── Analytics Daily Rollups ──────────────────────────────────────────────────

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(), // no .references() — cross-DB FK
    date: date("date").notNull(),
    event: text("event").notNull(),
    sourceType: text("source_type").notNull(), // sourceTypeEnum → text
    aiProvider: text("ai_provider").notNull().default("none"),
    country: text("country").notNull().default("unknown"),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("idx_analytics_rollups_unique").on(
      t.projectId,
      t.date,
      t.event,
      t.sourceType,
      t.aiProvider,
      t.country,
    ),
    index("idx_analytics_rollups_project_date").on(t.projectId, t.date),
  ],
);
