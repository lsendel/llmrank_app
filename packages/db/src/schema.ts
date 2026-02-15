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

export const account = pgTable("account", {
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
});

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
    shareToken: text("share_token").unique(),
    shareEnabled: boolean("share_enabled").default(false),
    sharedAt: timestamp("shared_at"),
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

// ---------------------------------------------------------------------------
// Page Facts (Semantic Analysis)
// ---------------------------------------------------------------------------

export const factTypeEnum = pgEnum("fact_type", [
  "metric", // Prices, counts, specs
  "definition", // "What is" explanations
  "claim", // Unique value propositions
  "quote", // Highly citable sentences
]);

export const reportTypeEnum = pgEnum("report_type", ["summary", "detailed"]);
export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx"]);
export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "generating",
  "complete",
  "failed",
]);

export const pageFacts = pgTable(
  "page_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    type: factTypeEnum("type").notNull(),
    content: text("content").notNull(),
    sourceSentence: text("source_sentence"),
    citabilityScore: integer("citability_score").default(0), // 0-100
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_facts_page").on(t.pageId)],
);

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
