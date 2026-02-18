import {
  pgTable,
  pgEnum,
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

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);

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

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  clerkId: text("clerk_id").unique(),
  name: text("name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  image: text("image"), // Better Auth expects 'image'
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  crawlCreditsRemaining: integer("crawl_credits_remaining")
    .notNull()
    .default(100),
  notifyOnCrawlComplete: boolean("notify_on_crawl_complete")
    .notNull()
    .default(true),
  notifyOnScoreDrop: boolean("notify_on_score_drop").notNull().default(true),
  webhookUrl: text("webhook_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  persona: personaEnum("persona"),
  digestFrequency: text("digest_frequency").notNull().default("off"),
  digestDay: integer("digest_day").notNull().default(1),
  lastDigestSentAt: timestamp("last_digest_sent_at"),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Better Auth: Sessions
// ---------------------------------------------------------------------------

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_session_user_id").on(t.userId)], // Removed t.token index as it's already unique
);

// ---------------------------------------------------------------------------
// Better Auth: Accounts
// ---------------------------------------------------------------------------

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_account_user_id").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Better Auth: Verification
// ---------------------------------------------------------------------------

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    settings: jsonb("settings").default({}),
    branding: jsonb("branding").default({}),
    crawlSchedule: crawlScheduleEnum("crawl_schedule")
      .notNull()
      .default("manual"),
    nextCrawlAt: timestamp("next_crawl_at"),
    scoringProfileId: uuid("scoring_profile_id"),
    leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
    teamId: uuid("team_id"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_projects_user").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Crawl Jobs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page Scores
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Insights (aggregated crawl + per-page signals)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Visibility Checks
// ---------------------------------------------------------------------------

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
    competitorMentions: jsonb("competitor_mentions"),
    r2ResponseKey: text("r2_response_key"),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (t) => [index("idx_vis_project").on(t.projectId, t.checkedAt)],
);

// ---------------------------------------------------------------------------
// Discovered Links (backlinks from own crawler)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("succeeded"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_payments_user").on(t.userId),
    index("idx_payments_subscription").on(t.subscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// Plan Price History (audit trail)
// ---------------------------------------------------------------------------

export const planPriceHistory = pgTable(
  "plan_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planCode: text("plan_code").notNull(),
    oldPriceCents: integer("old_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    changedBy: text("changed_by").references(() => users.id),
    reason: text("reason"),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
  (t) => [index("idx_price_history_plan").on(t.planCode)],
);

// ---------------------------------------------------------------------------
// Custom Extractors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Server Log Uploads
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_competitors_project").on(t.projectId)],
);

// ---------------------------------------------------------------------------
// Competitor Benchmarks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Project Integrations (GSC, PSI, GA4, Clarity)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page Enrichments (data from integrations)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Outbox Events
// ---------------------------------------------------------------------------

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

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_admin_audit_target").on(t.targetType, t.targetId)],
);

export const reportTypeEnum = pgEnum("report_type", ["summary", "detailed"]);
export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx"]);
export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "generating",
  "complete",
  "failed",
]);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Leads (captured from public report pages)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Notification Channels
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scheduled Visibility Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scan Results (public scanner, no auth required)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API Tokens
// ---------------------------------------------------------------------------

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
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

// ---------------------------------------------------------------------------
// Content Fixes (AI Content Rewriter)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Report Schedules (auto-generate after crawl)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Organizations & RBAC
// ---------------------------------------------------------------------------

export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: planEnum("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    settings: jsonb("settings").default({}),
    ssoEnabled: boolean("sso_enabled").notNull().default(false),
    ssoProvider: text("sso_provider"),
    ssoConfig: jsonb("sso_config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_organizations_slug").on(t.slug)],
);

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_org_members_unique").on(t.orgId, t.userId),
    index("idx_org_members_user").on(t.userId),
  ],
);

export const orgInvites = pgTable(
  "org_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRoleEnum("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_org_invites_org").on(t.orgId)],
);

// ---------------------------------------------------------------------------
// Action Items (Gamification/Workflow)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_logs_org_created").on(t.orgId, t.createdAt),
    index("idx_audit_logs_actor").on(t.actorId),
    index("idx_audit_logs_resource").on(t.resourceType, t.resourceId),
  ],
);

// ---------------------------------------------------------------------------
// Scoring Profiles (custom category weights)
// ---------------------------------------------------------------------------

export const scoringProfiles = pgTable(
  "scoring_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    weights: jsonb("weights")
      .$type<{
        technical: number;
        content: number;
        aiReadiness: number;
        performance: number;
      }>()
      .notNull(),
    disabledFactors: jsonb("disabled_factors").$type<string[]>().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_scoring_profiles_user").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Teams & RBAC
// ---------------------------------------------------------------------------

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: teamRoleEnum("role").notNull().default("viewer"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_team_members_unique").on(t.teamId, t.userId),
    index("idx_team_members_user").on(t.userId),
  ],
);

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: teamRoleEnum("role").notNull().default("viewer"),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_team_invitations_team").on(t.teamId)],
);
