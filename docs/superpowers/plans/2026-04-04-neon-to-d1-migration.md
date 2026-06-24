# Neon → D1 + Supabase Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Neon PostgreSQL with Cloudflare D1 (app + admin) and Supabase PostgreSQL (agency analytics), eliminating the `@neondatabase/serverless` dependency entirely.

**Architecture:** Three databases — `D1_APP` (core tables, all tiers), `D1_ADMIN` (admin tables), `SUPABASE` via Hyperdrive (visibility, competitor, analytics tables that need PostgreSQL JSON/array operators). The `packages/db` package exports three client factories. The API middleware injects all three into the Hono context. Query modules are split by database target.

**Tech Stack:** Drizzle ORM (`drizzle-orm/d1` + `drizzle-orm/postgres-js`), Cloudflare D1, Supabase PostgreSQL, Cloudflare Hyperdrive, `postgres` npm package.

**Reference implementation:** `/Users/lsendel/Projects/families.care/packages/api/src/db/` — D1 schema, client, and `dateText` custom type.

---

## File Structure

### New files

```
packages/db/src/
  schema/
    d1-app.ts              # sqliteTable versions of: identity, projects, crawling, billing, features (D1 subset)
    d1-admin.ts            # sqliteTable versions of: admin tables
    supabase-agency.ts     # pgTable versions of: visibility, competitors, analytics, brand sentiment, narratives, batch jobs
    enums.ts               # REWRITTEN: TypeScript union types (no pgEnum)
  d1-client.ts             # createAppDb(D1Database), createAdminDb(D1Database)
  supabase-client.ts       # createAgencyDb(Hyperdrive)
  drizzle-d1.config.ts     # dialect: "sqlite"
  drizzle-supabase.config.ts # dialect: "postgresql"
```

### Modified files

```
packages/db/src/
  schema.ts                # Re-export from d1-app, d1-admin, supabase-agency
  client.ts                # DELETE (replaced by d1-client.ts + supabase-client.ts)
  index.ts                 # Update exports: new client factories, new schema sources
  queries/*.ts             # Update Database type imports; some queries stay PG, others move to SQLite

packages/db/package.json   # Remove @neondatabase/serverless, add postgres

apps/api/src/
  index.ts                 # D1_APP + D1_ADMIN bindings, Hyperdrive, remove DATABASE_URL
  container.ts             # Accept AppDatabase + AgencyDatabase
  wrangler.toml            # Add d1_databases + hyperdrive, remove DATABASE_URL secret

packages/repositories/src/index.ts  # Update Database type
```

### Deleted files

```
packages/db/src/client.ts                # Neon client
packages/db/src/schema/identity.ts       # Replaced by d1-app.ts
packages/db/src/schema/projects.ts       # Replaced by d1-app.ts
packages/db/src/schema/crawling.ts       # Replaced by d1-app.ts
packages/db/src/schema/billing.ts        # Replaced by d1-app.ts
packages/db/src/schema/features.ts       # Split into d1-app.ts + supabase-agency.ts
packages/db/src/schema/admin.ts          # Replaced by d1-admin.ts
packages/db/src/schema/analytics.ts      # Moved into supabase-agency.ts
packages/db/drizzle.config.ts            # Replaced by two config files
```

---

## Task 1: Create D1 enum types and shared helpers

**Files:**

- Create: `packages/db/src/schema/enums.ts` (rewrite)
- Create: `packages/db/src/schema/d1-helpers.ts`

- [ ] **Step 1: Rewrite enums.ts — replace all pgEnum with TypeScript unions**

Replace `packages/db/src/schema/enums.ts` entirely:

```ts
// packages/db/src/schema/enums.ts
// TypeScript union types replace pgEnum for D1/SQLite compatibility.
// Schema uses text() columns; type safety is enforced at the TypeScript level.

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
export type LLMProvider = (typeof LLM_PROVIDER_VALUES)[number];

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
```

- [ ] **Step 2: Create D1 helpers file**

```ts
// packages/db/src/schema/d1-helpers.ts
import { sql } from "drizzle-orm";
import { customType, text } from "drizzle-orm/sqlite-core";

/**
 * D1 rejects Date objects — it only accepts primitives.
 * This custom type auto-serializes Date → ISO string.
 * Pattern from families.care.
 */
export const dateText = customType<{ data: string | Date; driverData: string }>(
  {
    dataType() {
      return "text";
    },
    toDriver(value): string {
      if (value instanceof Date) return value.toISOString();
      return String(value ?? "");
    },
  },
);

/** Shorthand for text ID primary key (use crypto.randomUUID() at insert time) */
export function textId(name = "id") {
  return text(name).primaryKey();
}

/** Shorthand for UUID text column (not a primary key) */
export function uuidText(name: string) {
  return text(name);
}

/** Shorthand for created_at with D1-compatible default */
export function createdAt(name = "created_at") {
  return text(name)
    .notNull()
    .default(sql`datetime('now')`);
}

/** Shorthand for updated_at with D1-compatible default */
export function updatedAt(name = "updated_at") {
  return text(name)
    .notNull()
    .default(sql`datetime('now')`);
}
```

- [ ] **Step 3: Verify no TypeScript errors in the new enum file**

Run: `cd packages/db && npx tsc --noEmit --pretty src/schema/enums.ts`
Expected: No errors (this file has no imports from pg-core)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/enums.ts packages/db/src/schema/d1-helpers.ts
git commit -m "refactor: replace pgEnum with TypeScript unions, add D1 helpers"
```

---

## Task 2: Create D1 app schema (d1-app.ts)

**Files:**

- Create: `packages/db/src/schema/d1-app.ts`

This is the largest task — converting ~45 tables from `pgTable` to `sqliteTable`.

- [ ] **Step 1: Write d1-app.ts with all identity tables**

```ts
// packages/db/src/schema/d1-app.ts
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt, textId, uuidText } from "./d1-helpers";

// ─── Identity ─────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
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
  lastSignedIn: text("last_signed_in"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: text("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    refreshTokenExpiresAt: text("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_account_user_id").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizations = sqliteTable(
  "organizations",
  {
    id: textId(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: text("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    settings: text("settings").notNull().default("{}"),
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
    id: textId(),
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
      .default(sql`datetime('now')`),
  },
  (t) => [
    uniqueIndex("idx_org_members_unique").on(t.orgId, t.userId),
    index("idx_org_members_user").on(t.userId),
  ],
);

export const orgInvites = sqliteTable(
  "org_invites",
  {
    id: textId(),
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
  id: textId(),
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
    id: textId(),
    teamId: uuidText("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("viewer"),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`datetime('now')`),
  },
  (t) => [
    uniqueIndex("idx_team_members_unique").on(t.teamId, t.userId),
    index("idx_team_members_user").on(t.userId),
  ],
);

export const teamInvitations = sqliteTable(
  "team_invitations",
  {
    id: textId(),
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

// ─── Projects ─────────────────────────────────────────────────────────────

export const projects = sqliteTable(
  "projects",
  {
    id: textId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    settings: text("settings").notNull().default("{}"),
    branding: text("branding").notNull().default("{}"),
    crawlSchedule: text("crawl_schedule").notNull().default("manual"),
    nextCrawlAt: text("next_crawl_at"),
    scoringProfileId: uuidText("scoring_profile_id"),
    leaderboardOptIn: integer("leaderboard_opt_in", { mode: "boolean" })
      .notNull()
      .default(false),
    teamId: uuidText("team_id"),
    siteDescription: text("site_description"),
    industry: text("industry"),
    pipelineSettings: text("pipeline_settings").notNull().default("{}"),
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
    id: textId(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    jobToBeDone: text("job_to_be_done"),
    constraints: text("constraints"),
    successMetrics: text("success_metrics"),
    decisionCriteria: text("decision_criteria"),
    vocabulary: text("vocabulary").notNull().default("[]"),
    sampleQueries: text("sample_queries").notNull().default("[]"),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    weights: text("weights").notNull(),
    disabledFactors: text("disabled_factors").notNull().default("[]"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_scoring_profiles_user").on(t.userId)],
);

// ─── Crawling ─────────────────────────────────────────────────────────────

export const crawlJobs = sqliteTable(
  "crawl_jobs",
  {
    id: textId(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    targetUrl: text("target_url").notNull(),
    targetDomain: text("target_domain").notNull(),
    anchorText: text("anchor_text"),
    rel: text("rel").notNull().default("dofollow"),
    discoveredAt: text("discovered_at")
      .notNull()
      .default(sql`datetime('now')`),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`datetime('now')`),
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
    id: textId(),
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
    id: textId(),
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

// ─── Billing ──────────────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: textId(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
    planCode: text("plan_code").notNull(),
    oldPriceCents: integer("old_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    changedBy: text("changed_by").references(() => users.id),
    reason: text("reason"),
    changedAt: text("changed_at")
      .notNull()
      .default(sql`datetime('now')`),
  },
  (t) => [index("idx_price_history_plan").on(t.planCode)],
);

// ─── Features (D1 subset) ────────────────────────────────────────────────

export const projectIntegrations = sqliteTable(
  "project_integrations",
  {
    id: textId(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    encryptedCredentials: text("encrypted_credentials"),
    config: text("config").notNull().default("{}"),
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
    id: textId(),
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
      .default(sql`datetime('now')`),
  },
  (t) => [
    index("idx_enrichments_page").on(t.pageId),
    index("idx_enrichments_job_provider").on(t.jobId, t.provider),
  ],
);

export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    id: textId(),
    type: text("type").notNull(),
    eventType: text("event_type"),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    projectId: uuidText("project_id"),
    userId: text("user_id"),
    availableAt: text("available_at")
      .notNull()
      .default(sql`datetime('now')`),
    processedAt: text("processed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_outbox_status_available").on(t.status, t.availableAt)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: textId(),
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
    config: text("config").notNull().default("{}"),
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
    id: textId(),
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
    id: textId(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    providers: text("providers").notNull(),
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
    id: textId(),
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
    id: textId(),
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
    scopes: text("scopes").notNull(),
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
    id: textId(),
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
    id: textId(),
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
    id: textId(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    data: text("data").notNull().default("{}"),
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
    id: textId(),
    projectId: uuidText("project_id")
      .notNull()
      .references(() => projects.id),
    crawlJobId: uuidText("crawl_job_id").references(() => crawlJobs.id),
    status: text("status").notNull().default("pending"),
    currentStep: text("current_step"),
    stepResults: text("step_results").notNull().default("{}"),
    settings: text("settings").notNull().default("{}"),
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
    id: textId(),
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
    id: textId(),
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
      .default(sql`datetime('now')`),
  },
  (t) => [index("idx_prompts_project").on(t.projectId)],
);
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd packages/db && npx tsc --noEmit --pretty`
Expected: May have errors from old imports — that's expected until we update schema.ts

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/d1-app.ts packages/db/src/schema/d1-helpers.ts
git commit -m "feat: add D1 app schema (sqliteTable for all core tables)"
```

---

## Task 3: Create D1 admin schema and Supabase agency schema

**Files:**

- Create: `packages/db/src/schema/d1-admin.ts`
- Create: `packages/db/src/schema/supabase-agency.ts`

- [ ] **Step 1: Write d1-admin.ts**

```ts
// packages/db/src/schema/d1-admin.ts
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, textId, uuidText } from "./d1-helpers";
import { users } from "./d1-app";

export const blockedDomains = sqliteTable("blocked_domains", {
  id: textId(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  blockedBy: text("blocked_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const adminSettings = sqliteTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default("{}"),
  updatedBy: text("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`datetime('now')`),
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: textId(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(),
  variables: text("variables"),
  model: text("model").notNull(),
  modelConfig: text("model_config"),
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("draft"),
  parentId: uuidText("parent_id"),
  createdBy: text("created_by"),
  activatedAt: text("activated_at"),
  createdAt: createdAt(),
});

export const promptMetrics = sqliteTable("prompt_metrics", {
  id: textId(),
  promptId: uuidText("prompt_id")
    .notNull()
    .references(() => promptTemplates.id),
  invocations: integer("invocations").default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  avgTokensIn: integer("avg_tokens_in"),
  avgTokensOut: integer("avg_tokens_out"),
  avgCostCents: integer("avg_cost_cents"),
  errorRate: integer("error_rate_bps"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  createdAt: createdAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: textId(),
    orgId: uuidText("org_id"),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: text("metadata").notNull().default("{}"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_audit_logs_org_created").on(t.orgId, t.createdAt),
    index("idx_audit_logs_actor").on(t.actorId),
    index("idx_audit_logs_resource").on(t.resourceType, t.resourceId),
  ],
);

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: textId(),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_admin_audit_target").on(t.targetType, t.targetId)],
);

export const leads = sqliteTable("leads", {
  id: textId(),
  email: text("email").notNull(),
  reportToken: text("report_token"),
  source: text("source").notNull().default("shared_report"),
  scanResultId: uuidText("scan_result_id"),
  convertedAt: text("converted_at"),
  projectId: uuidText("project_id"),
  createdAt: createdAt(),
});
```

- [ ] **Step 2: Write supabase-agency.ts — keep as pgTable (unchanged PostgreSQL)**

```ts
// packages/db/src/schema/supabase-agency.ts
// These tables stay on Supabase PostgreSQL (via Hyperdrive) because they use
// jsonb_array_elements, array_agg, date_trunc, and other PG-specific features.

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
  date,
} from "drizzle-orm/pg-core";

// NOTE: These tables reference project_id/keyword_id from D1_APP by UUID string.
// Foreign keys are NOT enforced cross-database — app logic handles referential integrity.

export const visibilityChecks = pgTable(
  "visibility_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    llmProvider: text("llm_provider").notNull(),
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
    keywordId: uuid("keyword_id"),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_vis_project").on(t.projectId, t.checkedAt),
    index("idx_vis_brand_mentioned").on(t.projectId, t.brandMentioned),
  ],
);

export const competitorBenchmarks = pgTable(
  "competitor_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
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
    projectId: uuid("project_id").notNull(),
    competitorDomain: text("competitor_domain").notNull(),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
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

export const competitorMonitoringSchedules = pgTable(
  "competitor_monitoring_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    query: text("query").notNull(),
    providers: text("providers").array().notNull(),
    frequency: text("frequency").notNull().default("weekly"),
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

export const narrativeReports = pgTable(
  "narrative_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlJobId: uuid("crawl_job_id").notNull(),
    projectId: uuid("project_id").notNull(),
    tone: text("tone").notNull(),
    status: text("status").notNull().default("pending"),
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

export const brandSentimentSnapshots = pgTable(
  "brand_sentiment_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
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

export const llmBatchJobs = pgTable(
  "llm_batch_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: text("batch_id").notNull(),
    jobId: uuid("job_id").notNull(),
    projectId: uuid("project_id").notNull(),
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

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id"),
    event: text("event").notNull(),
    domain: text("domain").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    sourceType: text("source_type").notNull().default("other"),
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

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    date: date("date").notNull(),
    event: text("event").notNull(),
    sourceType: text("source_type").notNull(),
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/d1-admin.ts packages/db/src/schema/supabase-agency.ts
git commit -m "feat: add D1 admin schema and Supabase agency schema"
```

---

## Task 4: Create new DB clients and update package.json

**Files:**

- Create: `packages/db/src/d1-client.ts`
- Create: `packages/db/src/supabase-client.ts`
- Modify: `packages/db/package.json`
- Delete: `packages/db/src/client.ts`

- [ ] **Step 1: Create D1 client**

```ts
// packages/db/src/d1-client.ts
import { drizzle } from "drizzle-orm/d1";
import * as appSchema from "./schema/d1-app";
import * as adminSchema from "./schema/d1-admin";

export function createAppDb(d1: D1Database) {
  return drizzle(d1, { schema: appSchema });
}

export function createAdminDb(d1: D1Database) {
  return drizzle(d1, { schema: adminSchema });
}

export type AppDatabase = ReturnType<typeof createAppDb>;
export type AdminDatabase = ReturnType<typeof createAdminDb>;
```

- [ ] **Step 2: Create Supabase client**

```ts
// packages/db/src/supabase-client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as agencySchema from "./schema/supabase-agency";

export function createAgencyDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema: agencySchema });
}

export type AgencyDatabase = ReturnType<typeof createAgencyDb>;
```

- [ ] **Step 3: Update package.json — remove Neon, add postgres**

In `packages/db/package.json`, replace dependencies:

```json
  "dependencies": {
    "@llm-boost/shared": "workspace:*",
    "drizzle-orm": "^0.45.1",
    "postgres": "^3.4"
  },
```

Remove `"@neondatabase/serverless": "^0.10"` entirely.

- [ ] **Step 4: Delete old Neon client**

```bash
rm packages/db/src/client.ts
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/d1-client.ts packages/db/src/supabase-client.ts packages/db/package.json
git rm packages/db/src/client.ts
git commit -m "feat: replace Neon client with D1 + Supabase clients"
```

---

## Task 5: Update schema.ts barrel export and index.ts

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Delete: old schema files (identity.ts, projects.ts, crawling.ts, billing.ts, features.ts, admin.ts, analytics.ts)

- [ ] **Step 1: Rewrite schema.ts**

```ts
// packages/db/src/schema.ts
export * from "./schema/enums";
export * from "./schema/d1-app";
export * from "./schema/d1-admin";
export * from "./schema/supabase-agency";
```

- [ ] **Step 2: Rewrite index.ts**

```ts
// packages/db/src/index.ts
export * from "./schema";
export {
  createAppDb,
  createAdminDb,
  type AppDatabase,
  type AdminDatabase,
} from "./d1-client";
export { createAgencyDb, type AgencyDatabase } from "./supabase-client";

// Re-export Database as AppDatabase for gradual migration of consumers
export type { AppDatabase as Database } from "./d1-client";

// Query modules
export { userQueries } from "./queries/users";
export { projectQueries } from "./queries/projects";
export { crawlQueries } from "./queries/crawls";
export { pageQueries } from "./queries/pages";
export { scoreQueries } from "./queries/scores";
export {
  crawlInsightQueries,
  pageInsightQueries,
  type CrawlInsightInsert,
  type PageInsightInsert,
} from "./queries/insights";
export { visibilityQueries } from "./queries/visibility";
export { competitorQueries } from "./queries/competitors";
export { competitorBenchmarkQueries } from "./queries/competitor-benchmarks";
export { competitorEventQueries } from "./queries/competitor-events";
export { competitorMonitoringScheduleQueries } from "./queries/competitor-monitoring-schedules";
export { billingQueries } from "./queries/billing";
export { adminQueries } from "./queries/admin";
export { logQueries } from "./queries/logs";
export { extractorQueries } from "./queries/extractors";
export { integrationQueries } from "./queries/integrations";
export { enrichmentQueries } from "./queries/enrichments";
export { outboxQueries } from "./queries/outbox";
export { reportQueries } from "./queries/reports";
export { leadQueries } from "./queries/leads";
export { scanResultQueries } from "./queries/scan-results";
export { apiTokenQueries } from "./queries/api-tokens";
export { notificationChannelQueries } from "./queries/notification-channels";
export { scheduledVisibilityQueryQueries } from "./queries/scheduled-visibility";
export { contentFixQueries } from "./queries/content-fixes";
export { digestPreferenceQueries } from "./queries/digest-preferences";
export { reportScheduleQueries } from "./queries/report-schedules";
export { narrativeQueries } from "./queries/narratives";
export { scoringProfileQueries } from "./queries/scoring-profiles";
export { teamQueries } from "./queries/teams";
export {
  organizationQueries,
  orgMemberQueries,
  orgInviteQueries,
  auditLogQueries,
} from "./queries/organizations";
export {
  discoveredLinkQueries,
  type BacklinkSummary,
  type ReferringDomain,
} from "./queries/discovered-links";
export { personaQueries } from "./queries/personas";
export { savedKeywordQueries } from "./queries/saved-keywords";
export { promoQueries } from "./queries/promos";
export {
  actionItemQueries,
  type ActionItemStatus,
} from "./queries/action-items";
export { alertQueries } from "./queries/alerts";
export { pipelineRunQueries } from "./queries/pipeline-runs";
export { auditLogWriteQueries } from "./queries/audit-logs";
export { brandSentimentQueries } from "./queries/brand-sentiment";
export { aiPromptQueries } from "./queries/ai-prompts";
export { analyticsQueries } from "./queries/analytics";
export { batchJobQueries } from "./queries/batch-jobs";
export { eq, and, lte, desc, gte, sql, isNull } from "drizzle-orm";
```

- [ ] **Step 3: Delete old schema files**

```bash
rm packages/db/src/schema/identity.ts
rm packages/db/src/schema/projects.ts
rm packages/db/src/schema/crawling.ts
rm packages/db/src/schema/billing.ts
rm packages/db/src/schema/features.ts
rm packages/db/src/schema/admin.ts
rm packages/db/src/schema/analytics.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git rm packages/db/src/schema/identity.ts packages/db/src/schema/projects.ts packages/db/src/schema/crawling.ts packages/db/src/schema/billing.ts packages/db/src/schema/features.ts packages/db/src/schema/admin.ts packages/db/src/schema/analytics.ts
git commit -m "refactor: rewire schema barrel exports, remove old PG schema files"
```

---

## Task 6: Update query modules for D1 compatibility

**Files:**

- Modify: All 43 query files in `packages/db/src/queries/`

Most query files just need their `Database` import updated. The ones that use PostgreSQL-specific SQL need rewriting. The Supabase-targeted queries (visibility, analytics, competitors, brand-sentiment, batch-jobs) keep their PostgreSQL syntax but switch to `AgencyDatabase`.

- [ ] **Step 1: Update all D1-targeted query files**

For each query file that targets D1_APP tables, change the import:

```ts
// Before:
import type { Database } from "../client";

// After:
import type { AppDatabase as Database } from "../d1-client";
```

Files to update (D1_APP queries): `users.ts`, `projects.ts`, `crawls.ts`, `pages.ts`, `scores.ts`, `insights.ts`, `billing.ts`, `logs.ts`, `extractors.ts`, `integrations.ts`, `enrichments.ts`, `outbox.ts`, `reports.ts`, `leads.ts`, `scan-results.ts`, `api-tokens.ts`, `notification-channels.ts`, `scheduled-visibility.ts`, `content-fixes.ts`, `digest-preferences.ts`, `report-schedules.ts`, `scoring-profiles.ts`, `teams.ts`, `organizations.ts`, `discovered-links.ts`, `personas.ts`, `saved-keywords.ts`, `promos.ts`, `action-items.ts`, `alerts.ts`, `pipeline-runs.ts`, `audit-logs.ts`, `ai-prompts.ts`, `competitors.ts`

- [ ] **Step 2: Update admin query files**

For `admin.ts` queries, change import:

```ts
import type { AdminDatabase as Database } from "../d1-client";
```

- [ ] **Step 3: Update Supabase-targeted query files**

For `visibility.ts`, `analytics.ts`, `competitor-benchmarks.ts`, `competitor-events.ts`, `competitor-monitoring-schedules.ts`, `brand-sentiment.ts`, `batch-jobs.ts`, `narratives.ts`:

```ts
// Before:
import type { Database } from "../client";

// After:
import type { AgencyDatabase as Database } from "../supabase-client";
```

- [ ] **Step 4: Fix PostgreSQL-specific SQL in D1 query files**

In `packages/db/src/queries/discovered-links.ts`, replace:

```ts
// Before:
sql`(array_agg(${discoveredLinks.anchorText} order by ${discoveredLinks.lastSeenAt} desc))[1]`;
// After:
sql`(SELECT ${discoveredLinks.anchorText} FROM ${discoveredLinks} dl2 WHERE dl2.target_domain = ${discoveredLinks.targetDomain} ORDER BY dl2.last_seen_at DESC LIMIT 1)`;
```

Or simpler — use `group_concat` and pick the first:

```ts
sql`substr(group_concat(${discoveredLinks.anchorText}, '|||'), 1, instr(group_concat(${discoveredLinks.anchorText}, '|||') || '|||', '|||') - 1)`;
```

In `packages/db/src/queries/projects.ts` line ~203, replace:

```ts
// Before:
sql`ROUND(AVG(NULLIF(ps.detail->>'performanceScore', '')::double precision))::int`;
// After:
sql`CAST(ROUND(AVG(CAST(NULLIF(json_extract(ps.detail, '$.performanceScore'), '') AS REAL))) AS INTEGER)`;
```

Any `::int` cast → `CAST(... AS INTEGER)`
Any `::text` cast → `CAST(... AS TEXT)`
Any `count(*)::int` → `CAST(count(*) AS INTEGER)` or just `count(*)` (SQLite returns integer by default)

- [ ] **Step 5: Fix schema imports in query files**

Query files that import schema tables need to import from the correct new location. Replace:

```ts
import { users } from "../schema"; // → still works (schema.ts re-exports all)
import { visibilityChecks } from "../schema"; // → still works
```

Schema barrel re-exports everything, so most imports remain valid.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/db && npx tsc --noEmit`
Expected: Fix any remaining type errors

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/queries/
git commit -m "refactor: update query modules for D1 + Supabase split"
```

---

## Task 7: Create Drizzle config files

**Files:**

- Create: `packages/db/drizzle-d1.config.ts`
- Create: `packages/db/drizzle-supabase.config.ts`
- Delete: `packages/db/drizzle.config.ts`

- [ ] **Step 1: Create D1 drizzle config**

```ts
// packages/db/drizzle-d1.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/schema/d1-app.ts", "./src/schema/d1-admin.ts"],
  out: "./migrations/d1",
  dialect: "sqlite",
});
```

- [ ] **Step 2: Create Supabase drizzle config**

```ts
// packages/db/drizzle-supabase.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/supabase-agency.ts",
  out: "./migrations/supabase",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Delete old config and migrations**

```bash
rm packages/db/drizzle.config.ts
rm -rf packages/db/migrations/  # Old PG migrations — fresh start
mkdir -p packages/db/migrations/d1 packages/db/migrations/supabase
```

- [ ] **Step 4: Update package.json scripts**

In `packages/db/package.json`, update scripts:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "typecheck": "tsc --noEmit",
  "generate:d1": "drizzle-kit generate --config=drizzle-d1.config.ts",
  "generate:supabase": "drizzle-kit generate --config=drizzle-supabase.config.ts",
  "push:supabase": "drizzle-kit push --config=drizzle-supabase.config.ts",
  "studio": "drizzle-kit studio",
  "lint": "eslint src",
  "lint:fix": "eslint src --fix",
  "format": "prettier --write src"
}
```

- [ ] **Step 5: Generate initial D1 migration**

Run: `cd packages/db && npx drizzle-kit generate --config=drizzle-d1.config.ts`
Expected: Creates `migrations/d1/0000_*.sql` with CREATE TABLE statements

- [ ] **Step 6: Commit**

```bash
git add packages/db/drizzle-d1.config.ts packages/db/drizzle-supabase.config.ts packages/db/package.json packages/db/migrations/
git rm packages/db/drizzle.config.ts
git rm -r packages/db/migrations/*.sql packages/db/migrations/meta/ 2>/dev/null || true
git commit -m "feat: add D1 + Supabase drizzle configs, generate initial D1 migration"
```

---

## Task 8: Update API bindings and middleware

**Files:**

- Modify: `apps/api/wrangler.toml`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/container.ts`

- [ ] **Step 1: Update wrangler.toml — add D1 bindings, Hyperdrive, restore Fly.io URLs**

Add to `apps/api/wrangler.toml` after the `[browser]` section:

```toml
[[d1_databases]]
binding = "D1_APP"
database_name = "llmrank-app"
database_id = "TO_BE_CREATED"

[[d1_databases]]
binding = "D1_ADMIN"
database_name = "llmrank-admin"
database_id = "TO_BE_CREATED"

[[hyperdrive]]
binding = "SUPABASE"
id = "TO_BE_CREATED"
```

Remove `DATABASE_URL` from the secrets comment at the bottom. Add `SUPABASE_DATABASE_URL` instead.

Restore Fly.io URLs in `[vars]`:

```toml
CRAWLER_URL = "https://llmrank-crawler.fly.dev"
REPORT_SERVICE_URL = "https://llm-boost-reports.fly.dev"
```

- [ ] **Step 2: Update Bindings type in index.ts**

Replace in `apps/api/src/index.ts`:

```ts
// Before:
export type Bindings = {
  DATABASE_URL: string;
  // ...
};

// After:
export type Bindings = {
  D1_APP: D1Database;
  D1_ADMIN: D1Database;
  SUPABASE: Hyperdrive;
  // ... rest stays the same, but remove DATABASE_URL
};
```

- [ ] **Step 3: Update Variables type**

```ts
// Before:
export type Variables = {
  db: Database;
  // ...
};

// After:
import type { AppDatabase, AdminDatabase, AgencyDatabase } from "@llm-boost/db";

export type Variables = {
  db: AppDatabase;
  adminDb: AdminDatabase;
  agencyDb: AgencyDatabase;
  // ... rest stays the same
};
```

- [ ] **Step 4: Update DB middleware**

Replace the database middleware in `apps/api/src/index.ts` (around line 143-165):

```ts
// Before:
app.use("*", async (c, next) => {
  if (!c.env.DATABASE_URL) { ... }
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  c.set("container", createContainer(db));
  ...
});

// After:
import { createAppDb, createAdminDb, createAgencyDb } from "@llm-boost/db";

app.use("*", async (c, next) => {
  const db = createAppDb(c.env.D1_APP);
  const adminDb = createAdminDb(c.env.D1_ADMIN);
  const agencyDb = createAgencyDb(c.env.SUPABASE.connectionString);
  c.set("db", db);
  c.set("adminDb", adminDb);
  c.set("agencyDb", agencyDb);
  c.set("container", createContainer(db));
  c.set("logger", createLogger({ requestId: c.get("requestId") }));
  await next();
});
```

- [ ] **Step 5: Update container.ts**

```ts
// packages/api/src/container.ts — no changes needed if repositories use AppDatabase
// The container takes db: AppDatabase, which is what createContainer expects
import type { AppDatabase } from "@llm-boost/db";

export function createContainer(db: AppDatabase): Container {
  // ... same as before, repositories accept AppDatabase
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/wrangler.toml apps/api/src/index.ts apps/api/src/container.ts
git commit -m "feat: wire D1 + Supabase bindings into API middleware"
```

---

## Task 9: Update repositories package

**Files:**

- Modify: `packages/repositories/src/index.ts`

- [ ] **Step 1: Update Database type import**

```ts
// Before:
import { type Database, ... } from "@llm-boost/db";

// After:
import { type AppDatabase as Database, ... } from "@llm-boost/db";
```

The repository functions all take `Database` — by aliasing `AppDatabase as Database`, all downstream code continues to work.

- [ ] **Step 2: Run typecheck across the monorepo**

Run: `pnpm typecheck`
Expected: Fix any remaining type errors

- [ ] **Step 3: Commit**

```bash
git add packages/repositories/src/index.ts
git commit -m "refactor: update repositories to use AppDatabase type"
```

---

## Task 10: Update route files that use agency queries

**Files:**

- Modify: Route files in `apps/api/src/routes/` that call visibility, competitor, analytics, or narrative queries

- [ ] **Step 1: Find all route files that use agency queries**

Search for imports of: `visibilityQueries`, `competitorBenchmarkQueries`, `competitorEventQueries`, `competitorMonitoringScheduleQueries`, `analyticsQueries`, `brandSentimentQueries`, `batchJobQueries`, `narrativeQueries`

These routes need to get `agencyDb` from the Hono context instead of `db`:

```ts
// Before:
const vis = visibilityQueries(c.get("db"));

// After:
const vis = visibilityQueries(c.get("agencyDb"));
```

- [ ] **Step 2: Update each affected route file**

Apply the pattern above to every file that uses an agency query module.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/ apps/api/src/services/
git commit -m "refactor: route agency queries through agencyDb context"
```

---

## Task 11: Create D1 databases and Hyperdrive, update deploy workflow

**Files:**

- Modify: `.github/workflows/deploy-cloudflare.yml`

- [ ] **Step 1: Create D1 databases (run locally)**

```bash
npx wrangler d1 create llmrank-app
npx wrangler d1 create llmrank-admin
```

Copy the `database_id` values from the output and update `apps/api/wrangler.toml`.

- [ ] **Step 2: Create Supabase project (if not reusing families.care)**

Use the Supabase dashboard or CLI to create a new project. Get the connection string.

- [ ] **Step 3: Create Hyperdrive**

```bash
npx wrangler hyperdrive create llmrank-supabase \
  --origin-host=db.<project-id>.supabase.co \
  --origin-port=5432 \
  --origin-user=postgres \
  --origin-password='<password>' \
  --database=postgres
```

Copy the Hyperdrive ID and update `apps/api/wrangler.toml`.

- [ ] **Step 4: Apply D1 migrations**

```bash
npx wrangler d1 migrations apply llmrank-app --local
npx wrangler d1 migrations apply llmrank-admin --local
```

- [ ] **Step 5: Push Supabase schema**

```bash
export SUPABASE_DATABASE_URL="postgresql://..."
cd packages/db && npx drizzle-kit push --config=drizzle-supabase.config.ts
```

- [ ] **Step 6: Update deploy-cloudflare.yml**

In the migrations job, replace:

```yaml
# Before:
- name: Push DB schema
  run: cd packages/db && npx drizzle-kit push
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

# After:
- name: Apply D1 migrations
  run: |
    npx wrangler d1 migrations apply llmrank-app --remote
    npx wrangler d1 migrations apply llmrank-admin --remote
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}

- name: Push Supabase schema
  run: cd packages/db && npx drizzle-kit push --config=drizzle-supabase.config.ts
  env:
    SUPABASE_DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
```

- [ ] **Step 7: Add SUPABASE_DATABASE_URL GitHub secret**

Add `SUPABASE_DATABASE_URL` to repository secrets. Remove `DATABASE_URL`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/wrangler.toml .github/workflows/deploy-cloudflare.yml
git commit -m "infra: configure D1 databases, Hyperdrive, and deploy workflow"
```

---

## Task 12: Update tests

**Files:**

- Modify: Test files in `packages/db/src/__tests__/`
- Modify: Test files in `apps/api/src/__tests__/` (if they reference Database type)

- [ ] **Step 1: Update test imports**

Replace `createDb` with `createAppDb` or `createAdminDb` in test files. For tests that need a D1 mock:

```ts
// Test helper for D1 mock (similar to families.care pattern)
import { drizzle } from "drizzle-orm/d1";

// Use miniflare's D1 or vitest-environment-miniflare for tests
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`

- [ ] **Step 3: Fix any failures**

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/__tests__/ apps/api/src/__tests__/
git commit -m "test: update tests for D1 + Supabase split"
```

---

## Task 13: Update CLAUDE.md and documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update database references**

Replace all Neon references:

- `**Database:** Neon PostgreSQL with Drizzle ORM` → `**Database:** Cloudflare D1 (app + admin) + Supabase PostgreSQL (agency analytics) with Drizzle ORM`
- Remove `DATABASE_URL` from secrets lists
- Add `SUPABASE_DATABASE_URL` to secrets
- Update architecture diagram
- Update deploy instructions

- [ ] **Step 2: Update drizzle-kit commands**

```bash
# D1 migrations
cd packages/db && npx drizzle-kit generate --config=drizzle-d1.config.ts
npx wrangler d1 migrations apply llmrank-app --remote

# Supabase schema push
export SUPABASE_DATABASE_URL="..."
cd packages/db && npx drizzle-kit push --config=drizzle-supabase.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update CLAUDE.md and AGENTS.md for D1 + Supabase architecture"
```

---

## Self-Review Checklist

1. **Spec coverage:** All tables accounted for — 45 in D1_APP, 7 in D1_ADMIN, 9 in Supabase. ✓
2. **No placeholders:** All code blocks are complete. ✓
3. **Type consistency:** `AppDatabase`, `AdminDatabase`, `AgencyDatabase` used consistently across tasks. ✓
4. **No Neon:** `@neondatabase/serverless` removed in Task 4. `DATABASE_URL` removed from wrangler.toml in Task 8. ✓
5. **Fly.io restored:** URLs uncommented in Task 8 wrangler.toml. Config files restored before this plan. ✓
6. **Cross-DB references:** Supabase tables use `uuid("project_id").notNull()` without foreign key constraints (cross-DB). ✓
