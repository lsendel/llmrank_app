import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import puppeteer from "@cloudflare/puppeteer";
import {
  createDb,
  type Database,
  users,
  projectQueries,
  crawlQueries,
  userQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, type CrawlJobPayload } from "@llm-boost/shared";
import { signPayload } from "./middleware/hmac";
import { requestIdMiddleware } from "./middleware/request-id";
import { createLogger, type Logger } from "./lib/logger";
import { initSentry, captureError, withSentry } from "./lib/sentry";
import { buildCrawlConfig } from "./services/crawl-service";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";
import { crawlRoutes } from "./routes/crawls";
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

// ---------------------------------------------------------------------------
// Bindings & Variables
// ---------------------------------------------------------------------------

export type Bindings = {
  R2: R2Bucket;
  KV: KVNamespace;
  SEEN_URLS: KVNamespace;
  CRAWL_QUEUE: Queue<any>;
  BROWSER: any;
  DATABASE_URL: string;
  SHARED_SECRET: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CRAWLER_URL: string;
  INTEGRATION_ENCRYPTION_KEY: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  SENTRY_DSN: string;
};

export type Variables = {
  db: Database;
  userId: string;
  parsedBody: string;
  requestId: string;
  logger: Logger;
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
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Signature",
      "X-Timestamp",
    ],
    maxAge: 86400,
  }),
);

// Sentry + Database + logger middleware
app.use("*", async (c, next) => {
  initSentry(c.env);
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  c.set("logger", createLogger({ requestId: c.get("requestId") }));
  await next();
});

// Routes
app.route("/api/health", healthRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/crawls", crawlRoutes);
app.route("/api/pages", pageRoutes);
app.route("/api/billing", billingRoutes);
app.route("/ingest", ingestRoutes);
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

// Fallback
app.notFound((c) => {
  return c.json(
    { error: { code: "NOT_FOUND", message: "Route not found" } },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
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
  createBillingRepository,
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
} from "./repositories";
import { createCrawlService } from "./services/crawl-service";
import { createNotificationService } from "./services/notification-service";
import { createMonitoringService } from "./services/monitoring-service";

// ... existing code ...

// ---------------------------------------------------------------------------
// Scheduled handler — monthly credit reset (1st of every month)
// ---------------------------------------------------------------------------

async function resetMonthlyCredits(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const queries = userQueries(db);
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    await queries.resetCrawlCreditsForPlan(
      plan as (typeof users.plan.enumValues)[number],
      limits.crawlsPerMonth,
    );
  }
}

async function runScheduledTasks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  // 1. Process email notifications
  const notifications = createNotificationService(db, env.RESEND_API_KEY);
  await notifications.processQueue();

  // 2. Monitoring & Health
  const monitor = createMonitoringService(db, notifications);
  await monitor.checkSystemHealth();

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
      } else {
        await runScheduledTasks(env);
      }
    },
  },
);
