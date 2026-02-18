import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";
import { createDb, type Database, users, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { requestIdMiddleware } from "./middleware/request-id";
import { cacheMiddleware } from "./middleware/cache";
import { createLogger, type Logger } from "./lib/logger";
import { initSentry, captureError, withSentry } from "./lib/sentry";
import { ServiceError } from "./services/errors";
import { createAuth } from "./lib/auth";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";
import { crawlRoutes } from "./routes/crawls";
import { queueRoutes } from "./routes/queue";
import { pageRoutes } from "./routes/pages";
import { billingRoutes } from "./routes/billing";
import { ingestRoutes } from "./routes/ingest";
import { visibilityRoutes } from "./routes/visibility";
import { scoreRoutes } from "./routes/scores";
import { dashboardRoutes } from "./routes/dashboard";
import { accountRoutes } from "./routes/account";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";
import { logRoutes } from "./routes/logs";
import { extractorRoutes } from "./routes/extractors";
import { integrationRoutes } from "./routes/integrations";
import { strategyRoutes } from "./routes/strategy";
import { browserRoutes } from "./routes/browser";
import { insightsRoutes } from "./routes/insights";
import { reportRoutes } from "./routes/reports";
import { reportUploadRoutes } from "./routes/report-upload";
import { fixRoutes } from "./routes/fixes";
import { competitorRoutes } from "./routes/competitors";
import { trendRoutes } from "./routes/trends";
import { notificationChannelRoutes } from "./routes/notification-channels";
import { visibilityScheduleRoutes } from "./routes/visibility-schedules";
import { tokenRoutes } from "./routes/api-tokens";
import { v1Routes } from "./routes/v1";
import { scoringProfileRoutes } from "./routes/scoring-profiles";
import { brandingRoutes } from "./routes/branding";
import { exportRoutes } from "./routes/exports";
import { generatorRoutes } from "./routes/generators";
import { teamRoutes } from "./routes/teams";
import { organizationRoutes } from "./routes/organizations";
import { backlinkRoutes } from "./routes/backlinks";
import type { TokenContext } from "./services/api-token-service";
import { type Container, createContainer } from "./container";
import { aggregateBenchmarks } from "./services/benchmark-aggregation-service";

// ---------------------------------------------------------------------------
// Bindings & Variables
// ---------------------------------------------------------------------------

export type Bindings = {
  R2: R2Bucket;
  KV: KVNamespace;
  SEEN_URLS: KVNamespace;
  CRAWL_QUEUE: Queue<any>;
  REPORT_QUEUE: Queue<any>; // deprecated — kept for backward compat
  REPORT_SERVICE_URL: string;
  BROWSER: any;
  DATABASE_URL: string;
  SHARED_SECRET: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  GEMINI_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CRAWLER_URL: string;
  INTEGRATION_ENCRYPTION_KEY: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  SENTRY_DSN: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  APP_BASE_URL: string;
  POSTHOG_API_KEY: string;
  BING_API_KEY: string;
  ADMIN_ALERT_EMAIL?: string;
  SLACK_ALERT_WEBHOOK_URL?: string;
  WEB_WORKER?: Fetcher;
};

export type Variables = {
  db: Database;
  userId: string;
  parsedBody: string;
  requestId: string;
  logger: Logger;
  tokenCtx: TokenContext;
  container: Container;
  // Ownership middleware sets these
  project?: any; // Set by withOwnership("project")
  crawl?: any; // Set by withOwnership("crawl")
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<AppEnv>();

// Global middleware
app.use("*", requestIdMiddleware);
app.use("*", timing());
// app.use("*", compress()); // Cloudflare handles compression automatically
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "https://llmrank.app",
      "https://www.llmrank.app",
      "https://llmboost.com",
      "https://www.llmboost.com",
    ],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Signature",
      "X-Timestamp",
    ],
    maxAge: 86400,
  }),
);

// Cache public routes (5 minutes cache, 1 hour stale-while-revalidate)
app.use(
  "/api/public/*",
  cacheMiddleware({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 3600,
  }),
);

// Sentry + Database + logger middleware
app.use("*", async (c, next) => {
  initSentry(c.env);

  if (!c.env.DATABASE_URL) {
    const log = createLogger({ requestId: c.get("requestId") });
    log.error("DATABASE_URL binding is missing");
    return c.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: "Database configuration is missing",
        },
      },
      500,
    );
  }

  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  c.set("container", createContainer(db));
  c.set("logger", createLogger({ requestId: c.get("requestId") }));
  await next();
});

// Routes
app.route("/api/health", healthRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/projects", brandingRoutes);
app.route("/api/projects", exportRoutes);
app.route("/api/crawls", crawlRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/pages", pageRoutes);
app.route("/api/billing", billingRoutes);
app.route("/ingest", ingestRoutes);
app.route("/api/visibility/schedules", visibilityScheduleRoutes);
app.route("/api/visibility", visibilityRoutes);
app.route("/api/scores", scoreRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/account", accountRoutes);
app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/extractors", extractorRoutes);
app.route("/api/integrations", integrationRoutes);
app.route("/api/strategy", strategyRoutes);
app.route("/api/browser", browserRoutes);
app.route("/api/crawls", insightsRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/fixes", fixRoutes);
app.route("/api/competitors", competitorRoutes);
app.route("/api/trends", trendRoutes);
app.route("/internal", reportUploadRoutes);
app.route("/api/notification-channels", notificationChannelRoutes);
app.route("/api/tokens", tokenRoutes);
app.route("/api/v1", v1Routes);
app.route("/api/scoring-profiles", scoringProfileRoutes);
app.route("/api/projects", generatorRoutes);
app.route("/api/teams", teamRoutes);
app.route("/api/orgs", organizationRoutes);
app.route("/api/backlinks", backlinkRoutes);

// Better Auth Routes
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Fallback
app.notFound((c) => {
  return c.json(
    { error: { code: "NOT_FOUND", message: "Route not found" } },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  // Return proper status for known service errors (e.g. from ownership middleware)
  if (err instanceof ServiceError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as import("hono/utils/http-status").ContentfulStatusCode,
    );
  }

  const log =
    c.get("logger") ?? createLogger({ requestId: c.get("requestId") });
  log.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });
  captureError(err, {
    requestId: c.get("requestId"),
    path: c.req.path,
    method: c.req.method,
  });
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500,
  );
});

import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
  createVisibilityRepository,
  createCompetitorRepository,
} from "./repositories";
import { createCrawlService } from "./services/crawl-service";
import { createNotificationService } from "./services/notification-service";
import { createMonitoringService } from "./services/monitoring-service";
import { createVisibilityService } from "./services/visibility-service";
import {
  scheduledVisibilityQueryQueries,
  visibilityQueries,
  projectQueries,
  outboxEvents,
  scanResultQueries,
  leadQueries,
} from "@llm-boost/db";
import { trackServer } from "./lib/telemetry";
import { createDigestService } from "./services/digest-service";
import { processOutboxEvents } from "./services/outbox-processor";

// ... existing code ...

// ---------------------------------------------------------------------------
// Scheduled handler — monthly credit reset (1st of every month)
// ---------------------------------------------------------------------------

async function resetMonthlyCredits(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const queries = userQueries(db);
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    const credits = Number.isFinite(limits.crawlsPerMonth)
      ? limits.crawlsPerMonth
      : 999999;
    await queries.resetCrawlCreditsForPlan(
      plan as (typeof users.plan.enumValues)[number],
      credits,
    );
  }
}

async function runScheduledTasks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  // 1. Process email notifications
  const notifications = createNotificationService(db, env.RESEND_API_KEY, {
    appBaseUrl: env.APP_BASE_URL,
  });
  await notifications.processQueue();

  // 2. Monitoring & Health
  const monitor = createMonitoringService(db, notifications);
  await monitor.checkSystemHealth();

  // 2b. Crawler health check
  await monitor.checkCrawlerHealth(env.CRAWLER_URL, env.KV, {
    adminEmail: env.ADMIN_ALERT_EMAIL,
    slackWebhookUrl: env.SLACK_ALERT_WEBHOOK_URL,
    resendApiKey: env.RESEND_API_KEY,
  });

  // 3. Dispatch scheduled crawls
  const crawlService = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  await crawlService.dispatchScheduledJobs({
    crawlerUrl: env.CRAWLER_URL,
    sharedSecret: env.SHARED_SECRET,
    queue: env.CRAWL_QUEUE,
  });

  // 4. Process outbox events (enrichments, LLM scoring, crawl summaries)
  await processOutboxEvents(env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Cleanup cron — daily at 3 AM UTC
// ---------------------------------------------------------------------------

async function cleanupExpiredData(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);

  // Delete expired scan results (30-day TTL handled by expiresAt column)
  const deletedScans = await scanResultQueries(db).deleteExpired();
  console.log(`Cleaned up ${deletedScans} expired scan results`);

  // Delete unconverted leads older than 90 days
  const deletedLeads = await leadQueries(db).deleteOldUnconverted(90);
  console.log(`Cleaned up ${deletedLeads} stale leads`);
}

// ---------------------------------------------------------------------------
// Scheduled Visibility — 15-minute cron worker
// ---------------------------------------------------------------------------

interface VisibilityCheckResult {
  provider: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
}

async function detectAndEmitChanges(
  db: Database,
  schedule: { id: string; projectId: string; query: string },
  project: { id: string; userId: string; domain: string },
  results: VisibilityCheckResult[],
  previousByProvider: Map<
    string,
    { brandMentioned: boolean; citationPosition: number | null }
  >,
): Promise<void> {
  for (const result of results) {
    const previous = previousByProvider.get(result.provider);

    if (!previous) continue;

    // Detect mention lost
    if (previous.brandMentioned === true && result.brandMentioned === false) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "mention_lost",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        },
      });
    }

    // Detect mention gained
    if (previous.brandMentioned === false && result.brandMentioned === true) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "mention_gained",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        },
      });
    }

    // Detect position changed
    if (
      previous.citationPosition !== result.citationPosition &&
      result.citationPosition != null
    ) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "position_changed",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          oldPosition: previous.citationPosition,
          newPosition: result.citationPosition,
        },
      });
    }
  }
}

async function processScheduledVisibilityChecks(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const scheduleRepo = scheduledVisibilityQueryQueries(db);
  const visQueries = visibilityQueries(db);

  const dueQueries = await scheduleRepo.getDueQueries(new Date());
  const batch = dueQueries.slice(0, 10);

  for (const schedule of batch) {
    try {
      const pq = projectQueries(db);
      const project = await pq.getById(schedule.projectId);
      if (!project) {
        await scheduleRepo.markRun(schedule.id, schedule.frequency);
        continue;
      }

      // Fetch previous checks BEFORE running the new check to avoid the
      // race condition where getLatestForQuery returns the newly-stored
      // row instead of the previous one.
      const previousByProvider = new Map<
        string,
        { brandMentioned: boolean; citationPosition: number | null }
      >();
      for (const provider of schedule.providers) {
        const prev = await visQueries.getLatestForQuery(
          schedule.projectId,
          schedule.query,
          provider,
        );
        if (prev) {
          previousByProvider.set(provider, {
            brandMentioned: prev.brandMentioned ?? false,
            citationPosition: prev.citationPosition ?? null,
          });
        }
      }

      const visibilityService = createVisibilityService({
        projects: createProjectRepository(db),
        users: createUserRepository(db),
        visibility: createVisibilityRepository(db),
        competitors: createCompetitorRepository(db),
      });

      const stored = await visibilityService.runCheck({
        userId: project.userId,
        projectId: schedule.projectId,
        query: schedule.query,
        providers: schedule.providers,
        apiKeys: {
          chatgpt: env.OPENAI_API_KEY,
          claude: env.ANTHROPIC_API_KEY,
          perplexity: env.PERPLEXITY_API_KEY,
          gemini: env.GOOGLE_API_KEY,
          copilot: env.BING_API_KEY,
          gemini_ai_mode: env.GOOGLE_API_KEY,
        },
      });

      if (!stored || stored.length === 0) {
        await scheduleRepo.markRun(schedule.id, schedule.frequency);
        continue;
      }

      const results: VisibilityCheckResult[] = stored.map((s) => ({
        provider: s.llmProvider,
        brandMentioned: s.brandMentioned ?? false,
        urlCited: s.urlCited ?? false,
        citationPosition: s.citationPosition ?? null,
      }));

      await detectAndEmitChanges(
        db,
        schedule,
        project,
        results,
        previousByProvider,
      );
      await scheduleRepo.markRun(schedule.id, schedule.frequency);

      trackServer(
        env.POSTHOG_API_KEY,
        project.userId,
        "scheduled_visibility_check_completed",
        {
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          query: schedule.query,
          providers: schedule.providers,
        },
      );
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        scheduleId: schedule.id,
        context: "cron-visibility",
      });
      // Log and continue — don't let one failure block the rest
      const log = createLogger({ requestId: "cron-visibility" });
      log.error("Scheduled visibility check failed", {
        scheduleId: schedule.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Still mark the run so we don't repeatedly fail on the same schedule
      await scheduleRepo.markRun(schedule.id, schedule.frequency);
    }
  }
}

export default withSentry(
  (env: Bindings) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1 }),
  {
    fetch: app.fetch,
    async scheduled(
      controller: ScheduledController,
      env: Bindings,
      _ctx: ExecutionContext,
    ) {
      if (controller.cron === "0 0 1 * *") {
        await resetMonthlyCredits(env);
      } else if (controller.cron === "*/15 * * * *") {
        await processScheduledVisibilityChecks(env);
      } else if (controller.cron === "0 3 * * *") {
        await cleanupExpiredData(env);
      } else if (controller.cron === "0 9 * * 1") {
        // Weekly digest — Mondays at 9 AM UTC
        const db = createDb(env.DATABASE_URL);
        const digest = createDigestService(db, env.RESEND_API_KEY, {
          appBaseUrl: env.APP_BASE_URL,
        });
        await digest.processWeeklyDigests();
      } else if (controller.cron === "0 9 1 * *") {
        // Monthly digest — 1st of month at 9 AM UTC
        const db = createDb(env.DATABASE_URL);
        const digest = createDigestService(db, env.RESEND_API_KEY, {
          appBaseUrl: env.APP_BASE_URL,
        });
        await digest.processMonthlyDigests();
      } else if (controller.cron === "0 4 * * *") {
        // Daily benchmark aggregation — 4 AM UTC
        const db = createDb(env.DATABASE_URL);
        await aggregateBenchmarks(db, env.KV);
      } else {
        await runScheduledTasks(env);
      }
    },
  },
);
