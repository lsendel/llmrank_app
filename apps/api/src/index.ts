import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";
import { createDb, type Database } from "@llm-boost/db";
import { requestIdMiddleware } from "./middleware/request-id";
import { cacheMiddleware } from "./middleware/cache";
import { createLogger, type Logger } from "./lib/logger";
import { initSentry, captureError, withSentry } from "./lib/sentry";
import { ServiceError } from "./services/errors";
import type { TokenContext } from "./services/api-token-service";
import { type Container, createContainer } from "./container";
import {
  registerApiRoutes,
  registerAuthRoutes,
  registerFirstPartyRoutes,
} from "./routes/register";
import { handleScheduled } from "./scheduled";

export type Bindings = {
  R2: R2Bucket;
  KV: KVNamespace;
  SEEN_URLS: KVNamespace;
  CRAWL_QUEUE: Queue<any>;
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
  META_APP_ID: string;
  META_APP_SECRET: string;
  RESEND_API_KEY: string;
  SENTRY_DSN: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  APP_BASE_URL: string;
  POSTHOG_API_KEY: string;
  BING_API_KEY: string;
  XAI_API_KEY: string;
  ADMIN_ALERT_EMAIL?: string;
  SLACK_ALERT_WEBHOOK_URL?: string;
  CONNECT_SECRET?: string;
  WEB_WORKER?: Fetcher;
};

export type Variables = {
  db: Database;
  userId: string;
  user?: { id: string; plan: string; status: string; [key: string]: unknown };
  parsedBody: string;
  requestId: string;
  logger: Logger;
  tokenCtx: TokenContext;
  container: Container;
  project?: any;
  crawl?: any;
  isHtmx: boolean;
  hxTarget: string | null;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

app.use("*", requestIdMiddleware);
app.use("*", timing());
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

app.use(
  "/api/public/*",
  cacheMiddleware({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 3600,
  }),
);

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

registerApiRoutes(app);
registerFirstPartyRoutes(app);
registerAuthRoutes(app);

app.notFound((c) => {
  return c.json(
    { error: { code: "NOT_FOUND", message: "Route not found" } },
    404,
  );
});

app.onError((err, c) => {
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

export default withSentry(
  (env: Bindings) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1 }),
  {
    fetch: app.fetch,
    async scheduled(
      controller: ScheduledController,
      env: Bindings,
      _ctx: ExecutionContext,
    ) {
      await handleScheduled(controller, env);
    },
  },
);
