import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { createdAt, dateText, textId, updatedAt, uuidText } from "./d1-helpers";

// ─── Identity ────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: textId(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  clerkId: text("clerk_id").unique(),
  name: text("name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  image: text("image"),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  crawlCreditsRemaining: integer("crawl_credits_remaining")
    .notNull()
    .default(100),
  notifyOnCrawlComplete: integer("notify_on_crawl_complete", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  notifyOnScoreDrop: integer("notify_on_score_drop", { mode: "boolean" })
    .notNull()
    .default(true),
  webhookUrl: text("webhook_url"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  suspendedAt: text("suspended_at"),
  suspendedReason: text("suspended_reason"),
  onboardingComplete: integer("onboarding_complete", { mode: "boolean" })
    .notNull()
    .default(false),
  persona: text("persona"),
  digestFrequency: text("digest_frequency").notNull().default("off"),
  digestDay: integer("digest_day").notNull().default(1),
  lastDigestSentAt: text("last_digest_sent_at"),
  trialStartedAt: text("trial_started_at"),
  trialEndsAt: text("trial_ends_at"),
  lastSignedIn: dateText("last_signed_in"),
  createdAt: dateText("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: dateText("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const session = sqliteTable(
  "session",
  {
    id: textId(),
    expiresAt: dateText("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: dateText("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: dateText("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_session_user_id").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: textId(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: dateText("access_token_expires_at"),
    refreshTokenExpiresAt: dateText("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: dateText("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: dateText("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_account_user_id").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: textId(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: dateText("expires_at").notNull(),
  createdAt: dateText("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: dateText("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const organizations = sqliteTable(
  "organizations",
  {
    id: uuidText("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: text("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    settings: text("settings").default("{}"),
    ssoEnabled: integer("sso_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    ssoProvider: text("sso_provider"),
    ssoConfig: text("sso_config"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_organizations_slug").on(t.slug)],
);

export const orgMembers = sqliteTable(
  "org_members",
  {
    id: uuidText("id").primaryKey(),
    orgId: uuidText("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: text("invited_at"),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_org_members_unique").on(t.orgId, t.userId),
    index("idx_org_members_user").on(t.userId),
  ],
);

export const orgInvites = sqliteTable(
  "org_invites",
  {
    id: uuidText("id").primaryKey(),
    orgId: uuidText("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_org_invites_org").on(t.orgId)],
);

export const teams = sqliteTable("teams", {
  id: uuidText("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  plan: text("plan").notNull().default("free"),
  createdAt: createdAt(),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: uuidText("id").primaryKey(),
    teamId: uuidText("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("viewer"),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_team_members_unique").on(t.teamId, t.userId),
    index("idx_team_members_user").on(t.userId),
  ],
);

export const teamInvitations = sqliteTable(
  "team_invitations",
  {
    id: uuidText("id").primaryKey(),
    teamId: uuidText("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("viewer"),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_team_invitations_team").on(t.teamId)],
);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = sqliteTable(
  "projects",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    settings: text("settings").default("{}"),
    branding: text("branding").default("{}"),
    crawlSchedule: text("crawl_schedule").notNull().default("manual"),
    nextCrawlAt: text("next_crawl_at"),
    scoringProfileId: uuidText("scoring_profile_id"),
    leaderboardOptIn: integer("leaderboard_opt_in", { mode: "boolean" })
      .notNull()
      .default(false),
    teamId: uuidText("team_id"),
    siteDescription: text("site_description"),
    industry: text("industry"),
    pipelineSettings: text("pipeline_settings").default("{}"),
    siteDescriptionSource: text("site_description_source").default("auto"),
    industrySource: text("industry_source").default("auto"),
    businessGoal: text("business_goal"),
    faviconUrl: text("favicon_url"),
    analyticsSnippetEnabled: integer("analytics_snippet_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_projects_user").on(t.userId)],
);

export const personas = sqliteTable(
  "personas",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    jobToBeDone: text("job_to_be_done"),
    constraints: text("constraints"),
    successMetrics: text("success_metrics"),
    decisionCriteria: text("decision_criteria"),
    vocabulary: text("vocabulary").default("[]"),
    sampleQueries: text("sample_queries").default("[]"),
    funnelStage: text("funnel_stage").notNull().default("education"),
    avatarUrl: text("avatar_url"),
    isAutoGenerated: integer("is_auto_generated", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: createdAt(),
  },
  (t) => [index("idx_personas_project").on(t.projectId)],
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    source: text("source").notNull().default("user_added"),
    monitoringEnabled: integer("monitoring_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    monitoringFrequency: text("monitoring_frequency")
      .notNull()
      .default("weekly"),
    nextBenchmarkAt: text("next_benchmark_at"),
    lastBenchmarkAt: text("last_benchmark_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_competitors_project").on(t.projectId),
    index("idx_competitors_next_benchmark").on(
      t.nextBenchmarkAt,
      t.monitoringEnabled,
    ),
  ],
);

export const savedKeywords = sqliteTable(
  "saved_keywords",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    source: text("source").notNull().default("user_added"),
    relevanceScore: real("relevance_score"),
    funnelStage: text("funnel_stage"),
    personaId: uuidText("persona_id").references(() => personas.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_saved_keywords_project").on(t.projectId),
    index("idx_saved_keywords_persona").on(t.personaId),
  ],
);

export const scoringProfiles = sqliteTable(
  "scoring_profiles",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    weights: text("weights").notNull(),
    disabledFactors: text("disabled_factors").default("[]"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_scoring_profiles_user").on(t.userId)],
);

// ─── Crawling ─────────────────────────────────────────────────────────────────

export const crawlJobs = sqliteTable(
  "crawl_jobs",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    config: text("config").notNull(),
    pagesFound: integer("pages_found").default(0),
    pagesCrawled: integer("pages_crawled").default(0),
    pagesScored: integer("pages_scored").default(0),
    errorMessage: text("error_message"),
    r2Prefix: text("r2_prefix"),
    summary: text("summary"),
    summaryData: text("summary_data"),
    siteContext: text("site_context"),
    shareToken: text("share_token").unique(),
    shareEnabled: integer("share_enabled", { mode: "boolean" }).default(false),
    sharedAt: text("shared_at"),
    shareLevel: text("share_level").default("summary"),
    shareExpiresAt: text("share_expires_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    // Activity timestamp — bumped on every status/progress write (each ingest
    // batch). The stall watchdog uses this (not createdAt) so a crawler that
    // dies mid-run is detected by inactivity in minutes, not 6h from creation.
    updatedAt: updatedAt(),
    // Number of times this job was auto-re-dispatched after a stall. Bounds the
    // recovery loop so a persistently-failing crawl is failed, not retried forever.
    redispatchCount: integer("redispatch_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_jobs_project").on(t.projectId),
    index("idx_jobs_status").on(t.status),
    index("idx_jobs_share_token").on(t.shareToken),
    index("idx_jobs_project_status_created").on(
      t.projectId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: uuidText("id").primaryKey(),
    jobId: uuidText("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id")
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
    crawledAt: text("crawled_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_pages_job").on(t.jobId),
    index("idx_pages_url").on(t.projectId, t.url),
  ],
);

export const pageScores = sqliteTable(
  "page_scores",
  {
    id: uuidText("id").primaryKey(),
    pageId: uuidText("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuidText("job_id")
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
    detail: text("detail"),
    platformScores: text("platform_scores"),
    recommendations: text("recommendations"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_scores_job").on(t.jobId),
    index("idx_scores_page").on(t.pageId),
    index("idx_scores_job_overall").on(t.jobId, t.overallScore),
  ],
);

export const issues = sqliteTable(
  "issues",
  {
    id: uuidText("id").primaryKey(),
    pageId: uuidText("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuidText("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    recommendation: text("recommendation"),
    data: text("data"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_issues_page").on(t.pageId),
    index("idx_issues_severity").on(t.jobId, t.severity),
    index("idx_issues_job_code").on(t.jobId, t.code),
  ],
);

export const crawlInsights = sqliteTable(
  "crawl_insights",
  {
    id: uuidText("id").primaryKey(),
    crawlId: uuidText("crawl_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    type: text("type").notNull(),
    severity: text("severity"),
    headline: text("headline").notNull(),
    summary: text("summary"),
    data: text("data").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_crawl_insights_crawl").on(t.crawlId),
    index("idx_crawl_insights_project").on(t.projectId),
    index("idx_crawl_insights_type").on(t.type),
  ],
);

export const pageInsights = sqliteTable(
  "page_insights",
  {
    id: uuidText("id").primaryKey(),
    crawlId: uuidText("crawl_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuidText("page_id").references(() => pages.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    severity: text("severity"),
    headline: text("headline").notNull(),
    summary: text("summary"),
    data: text("data").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_page_insights_crawl").on(t.crawlId),
    index("idx_page_insights_project").on(t.projectId),
    index("idx_page_insights_page").on(t.pageId),
  ],
);

export const discoveredLinks = sqliteTable(
  "discovered_links",
  {
    id: uuidText("id").primaryKey(),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    targetUrl: text("target_url").notNull(),
    targetDomain: text("target_domain").notNull(),
    anchorText: text("anchor_text"),
    rel: text("rel").notNull().default("dofollow"),
    discoveredAt: text("discovered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_discovered_links_unique").on(t.sourceUrl, t.targetUrl),
    index("idx_discovered_links_target").on(t.targetDomain, t.discoveredAt),
    index("idx_discovered_links_source").on(t.sourceDomain),
  ],
);

export const customExtractors = sqliteTable(
  "custom_extractors",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    selector: text("selector").notNull(),
    attribute: text("attribute"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_extractors_project").on(t.projectId)],
);

export const actionItems = sqliteTable(
  "action_items",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuidText("page_id").references(() => pages.id, {
      onDelete: "cascade",
    }),
    issueCode: text("issue_code").notNull(),
    status: text("status").notNull().default("pending"),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    scoreImpact: real("score_impact").notNull().default(0),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => users.id),
    dueAt: text("due_at"),
    verifiedAt: text("verified_at"),
    verifiedByCrawlId: uuidText("verified_by_crawl_id").references(
      () => crawlJobs.id,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_action_items_project").on(t.projectId),
    index("idx_action_items_page").on(t.pageId),
    index("idx_action_items_status").on(t.status),
    index("idx_action_items_issue_page").on(t.projectId, t.issueCode, t.pageId),
  ],
);

// ─── Billing ──────────────────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    status: text("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    currentPeriodStart: text("current_period_start"),
    currentPeriodEnd: text("current_period_end"),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    canceledAt: text("canceled_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuidText("subscription_id").references(
      () => subscriptions.id,
    ),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("succeeded"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_payments_user").on(t.userId),
    index("idx_payments_subscription").on(t.subscriptionId),
  ],
);

export const promos = sqliteTable(
  "promos",
  {
    id: uuidText("id").primaryKey(),
    code: text("code").notNull().unique(),
    stripeCouponId: text("stripe_coupon_id").notNull(),
    stripePromotionCodeId: text("stripe_promotion_code_id"),
    discountType: text("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    duration: text("duration").notNull(),
    durationMonths: integer("duration_months"),
    maxRedemptions: integer("max_redemptions"),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    expiresAt: text("expires_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_promos_code").on(t.code),
    index("idx_promos_active").on(t.active),
  ],
);

export const planPriceHistory = sqliteTable(
  "plan_price_history",
  {
    id: uuidText("id").primaryKey(),
    planCode: text("plan_code").notNull(),
    oldPriceCents: integer("old_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    changedBy: text("changed_by").references(() => users.id),
    reason: text("reason"),
    changedAt: text("changed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_price_history_plan").on(t.planCode)],
);

// ─── Features ─────────────────────────────────────────────────────────────────

export const projectIntegrations = sqliteTable(
  "project_integrations",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    encryptedCredentials: text("encrypted_credentials"),
    config: text("config").default("{}"),
    tokenExpiresAt: text("token_expires_at"),
    lastSyncAt: text("last_sync_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_proj_integrations_project").on(t.projectId),
    uniqueIndex("idx_proj_integrations_unique").on(t.projectId, t.provider),
  ],
);

export const pageEnrichments = sqliteTable(
  "page_enrichments",
  {
    id: uuidText("id").primaryKey(),
    pageId: uuidText("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: uuidText("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    data: text("data").notNull(),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_enrichments_page").on(t.pageId),
    index("idx_enrichments_job_provider").on(t.jobId, t.provider),
  ],
);

export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    id: uuidText("id").primaryKey(),
    type: text("type").notNull(),
    eventType: text("event_type"),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    projectId: uuidText("project_id"),
    userId: text("user_id"),
    availableAt: text("available_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    processedAt: text("processed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_outbox_status_available").on(t.status, t.availableAt)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    crawlJobId: uuidText("crawl_job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    format: text("format").notNull(),
    status: text("status").notNull().default("queued"),
    r2Key: text("r2_key"),
    fileSize: integer("file_size"),
    config: text("config").default("{}"),
    error: text("error"),
    generatedAt: text("generated_at"),
    expiresAt: text("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_reports_project").on(t.projectId),
    index("idx_reports_user").on(t.userId),
  ],
);

export const notificationChannels = sqliteTable(
  "notification_channels",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    channelType: text("channel_type").notNull(),
    config: text("config").notNull().default("{}"),
    eventTypes: text("event_types").notNull().default("[]"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_notif_channels_user").on(t.userId)],
);

export const scheduledVisibilityQueries = sqliteTable(
  "scheduled_visibility_queries",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    providers: text("providers").notNull().default("[]"),
    frequency: text("frequency").notNull(),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_sched_vis_project").on(t.projectId),
    index("idx_sched_vis_next_run").on(t.nextRunAt, t.enabled),
  ],
);

export const scanResults = sqliteTable(
  "scan_results",
  {
    id: uuidText("id").primaryKey(),
    domain: text("domain").notNull(),
    url: text("url").notNull(),
    scores: text("scores").notNull(),
    issues: text("issues").notNull(),
    quickWins: text("quick_wins").notNull(),
    siteContext: text("site_context"),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_scan_results_expires").on(t.expiresAt)],
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull().default("api"),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").notNull().default("[]"),
    lastUsedAt: text("last_used_at"),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_api_tokens_user").on(t.userId),
    uniqueIndex("idx_api_tokens_hash").on(t.tokenHash),
  ],
);

export const contentFixes = sqliteTable(
  "content_fixes",
  {
    id: uuidText("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuidText("page_id").references(() => pages.id, {
      onDelete: "cascade",
    }),
    issueCode: text("issue_code").notNull(),
    fixType: text("fix_type").notNull(),
    originalContent: text("original_content"),
    generatedFix: text("generated_fix").notNull(),
    status: text("status").notNull().default("generated"),
    tokensUsed: integer("tokens_used"),
    model: text("model"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_content_fixes_user").on(t.userId),
    index("idx_content_fixes_project").on(t.projectId),
    index("idx_content_fixes_page").on(t.pageId),
  ],
);

export const reportSchedules = sqliteTable(
  "report_schedules",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    format: text("format").notNull().default("pdf"),
    type: text("type").notNull().default("summary"),
    recipientEmail: text("recipient_email").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_report_schedules_project").on(t.projectId)],
);

export const alerts = sqliteTable(
  "alerts",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    data: text("data").default("{}"),
    acknowledgedAt: text("acknowledged_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_alerts_project").on(t.projectId),
    index("idx_alerts_unacked").on(t.projectId, t.acknowledgedAt),
  ],
);

export const pipelineRuns = sqliteTable(
  "pipeline_runs",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id),
    crawlJobId: uuidText("crawl_job_id").references(() => crawlJobs.id),
    status: text("status").notNull().default("pending"),
    currentStep: text("current_step"),
    stepResults: text("step_results").default("{}"),
    settings: text("settings").default("{}"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_pipeline_runs_project").on(t.projectId),
    index("idx_pipeline_runs_crawl_job").on(t.crawlJobId),
  ],
);

export const logUploads = sqliteTable(
  "log_uploads",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    totalRequests: integer("total_requests").notNull().default(0),
    crawlerRequests: integer("crawler_requests").notNull().default(0),
    uniqueIPs: integer("unique_ips").notNull().default(0),
    summary: text("summary"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_log_uploads_project").on(t.projectId)],
);

export const aiPrompts = sqliteTable(
  "ai_prompts",
  {
    id: uuidText("id").primaryKey(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    category: text("category"),
    estimatedVolume: integer("estimated_volume"),
    difficulty: real("difficulty"),
    intent: text("intent"),
    yourMentioned: integer("your_mentioned", { mode: "boolean" }).default(
      false,
    ),
    competitorsMentioned: text("competitors_mentioned"),
    source: text("source").notNull().default("discovered"),
    discoveredAt: text("discovered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_prompts_project").on(t.projectId)],
);
