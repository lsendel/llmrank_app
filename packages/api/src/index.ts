import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb, type Database, users } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { eq } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// Bindings & Variables
// ---------------------------------------------------------------------------

export type Bindings = {
  R2: R2Bucket;
  KV: KVNamespace;
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
};

export type Variables = {
  db: Database;
  userId: string;
  parsedBody: string;
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

// Database middleware — creates a db instance per request and stores it on context
app.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
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

// Fallback
app.notFound((c) => {
  return c.json(
    { error: { code: "NOT_FOUND", message: "Route not found" } },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
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

// ---------------------------------------------------------------------------
// Scheduled handler — monthly credit reset (1st of every month)
// ---------------------------------------------------------------------------

async function resetMonthlyCredits(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    await db
      .update(users)
      .set({ crawlCreditsRemaining: limits.crawlsPerMonth })
      .where(eq(users.plan, plan as (typeof users.plan.enumValues)[number]));
  }
}

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    _ctx: ExecutionContext,
  ) {
    await resetMonthlyCredits(env);
  },
};
