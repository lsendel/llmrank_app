import { pgTable, pgEnum, text, integer, real, boolean, timestamp, jsonb, index, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { crawlStatusEnum, issueCategoryEnum, issueSeverityEnum, insightCategoryEnum, shareLevelEnum } from "./enums";
import { users } from "./identity";
import { projects } from "./projects";

export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: crawlStatusEnum("status").notNull().default("pending"),
    config: jsonb("config").notNull(),
    pagesFound: integer("pages_found").default(0),
    pagesCrawled: integer("pages_crawled").default(0),
    pagesScored: integer("pages_scored").default(0),
    errorMessage: text("error_message"),
    r2Prefix: text("r2_prefix"),
    summary: text("summary"),
    summaryData: jsonb("summary_data"),
    siteContext: jsonb("site_context"),
    shareToken: text("share_token").unique(),
    shareEnabled: boolean("share_enabled").default(false),
    sharedAt: timestamp("shared_at"),
    shareLevel: shareLevelEnum("share_level").default("summary"),
    shareExpiresAt: timestamp("share_expires_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_jobs_project").on(t.projectId),
    index("idx_jobs_status").on(t.status),
    index("idx_jobs_share_token").on(t.shareToken),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    statusCode: integer("status_code"),
    title: text("title"),
    metaDesc: text("meta_desc"),
    contentHash: text("content_hash"),
    wordCount: integer("word_count"),
    contentType: text("content_type").default("unknown"),
    textLength: integer("text_length"),
    htmlLength: integer("html_length"),
    r2RawKey: text("r2_raw_key"),
    r2LhKey: text("r2_lh_key"),
    crawledAt: timestamp("crawled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_pages_job").on(t.jobId),
    index("idx_pages_url").on(t.projectId, t.url),
  ],
);

export const pageScores = pgTable(
  "page_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    overallScore: real("overall_score").notNull(),
    technicalScore: real("technical_score"),
    contentScore: real("content_score"),
    aiReadinessScore: real("ai_readiness_score"),
    llmsTxtScore: real("llms_txt_score"),
    robotsTxtScore: real("robots_txt_score"),
    sitemapScore: real("sitemap_score"),
    schemaMarkupScore: real("schema_markup_score"),
    metaTagsScore: real("meta_tags_score"),
    botAccessScore: real("bot_access_score"),
    contentCiteabilityScore: real("content_citeability_score"),
    lighthousePerf: real("lighthouse_perf"),
    lighthouseSeo: real("lighthouse_seo"),
    detail: jsonb("detail"),
    platformScores: jsonb("platform_scores"),
    recommendations: jsonb("recommendations"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_scores_job").on(t.jobId),
    index("idx_scores_page").on(t.pageId),
  ],
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    category: issueCategoryEnum("category").notNull(),
    severity: issueSeverityEnum("severity").notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    recommendation: text("recommendation"),
    data: jsonb("data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_issues_page").on(t.pageId),
    index("idx_issues_severity").on(t.jobId, t.severity),
  ],
);

export const crawlInsights = pgTable(
  "crawl_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: insightCategoryEnum("category").notNull(),
    type: text("type").notNull(),
    severity: issueSeverityEnum("severity"),
    headline: text("headline").notNull(),
    summary: text("summary"),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_crawl_insights_crawl").on(t.crawlId),
    index("idx_crawl_insights_project").on(t.projectId),
    index("idx_crawl_insights_type").on(t.type),
  ],
);

export const pageInsights = pgTable(
  "page_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    category: insightCategoryEnum("category").notNull(),
    type: text("type").notNull(),
    severity: issueSeverityEnum("severity"),
    headline: text("headline").notNull(),
    summary: text("summary"),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_page_insights_crawl").on(t.crawlId),
    index("idx_page_insights_project").on(t.projectId),
    index("idx_page_insights_page").on(t.pageId),
  ],
);

export const discoveredLinks = pgTable(
  "discovered_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    targetUrl: text("target_url").notNull(),
    targetDomain: text("target_domain").notNull(),
    anchorText: text("anchor_text"),
    rel: text("rel").notNull().default("dofollow"),
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_discovered_links_unique").on(t.sourceUrl, t.targetUrl),
    index("idx_discovered_links_target").on(t.targetDomain, t.discoveredAt),
    index("idx_discovered_links_source").on(t.sourceDomain),
  ],
);

export const customExtractors = pgTable(
  "custom_extractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // "css_selector" | "regex"
    selector: text("selector").notNull(), // CSS selector or regex pattern
    attribute: text("attribute"), // e.g., "href", "src", or null for text content
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_extractors_project").on(t.projectId)],
);

export const actionItems = pgTable(
  "action_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    issueCode: text("issue_code").notNull(),
    status: text("status").notNull().default("pending"),
    severity: issueSeverityEnum("severity").notNull(),
    category: issueCategoryEnum("category").notNull(),
    scoreImpact: real("score_impact").notNull().default(0),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => users.id),
    verifiedAt: timestamp("verified_at"),
    verifiedByCrawlId: uuid("verified_by_crawl_id").references(
      () => crawlJobs.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_action_items_project").on(t.projectId),
    index("idx_action_items_status").on(t.status),
  ],
);

