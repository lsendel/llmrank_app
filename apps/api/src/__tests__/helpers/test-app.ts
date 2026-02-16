import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, Bindings } from "../../index";
import { createKVStub } from "./kv-stub";
import { createR2Stub } from "./r2-stub";
import { createDb, type Database } from "@llm-boost/db";
import { createContainer } from "../../container";
import { ServiceError } from "../../services/errors";

import { healthRoutes } from "../../routes/health";
import { projectRoutes } from "../../routes/projects";
import { crawlRoutes } from "../../routes/crawls";
import { pageRoutes } from "../../routes/pages";
import { billingRoutes } from "../../routes/billing";
import { ingestRoutes } from "../../routes/ingest";
import { visibilityRoutes } from "../../routes/visibility";
import { scoreRoutes } from "../../routes/scores";
import { dashboardRoutes } from "../../routes/dashboard";
import { accountRoutes } from "../../routes/account";
import { publicRoutes } from "../../routes/public";
import { adminRoutes } from "../../routes/admin";
import { logRoutes } from "../../routes/logs";
import { extractorRoutes } from "../../routes/extractors";
import { integrationRoutes } from "../../routes/integrations";
import { strategyRoutes } from "../../routes/strategy";
import { browserRoutes } from "../../routes/browser";
import { reportRoutes } from "../../routes/reports";
import { fixRoutes } from "../../routes/fixes";
import { competitorRoutes } from "../../routes/competitors";

interface TestAppOptions {
  db?: Database;
  userId?: string;
  envOverrides?: Partial<Bindings>;
}

export function createTestApp(options: TestAppOptions = {}) {
  const userId = options.userId ?? "test-user-id";
  const kv = createKVStub();
  const r2 = createR2Stub();
  // Use a dummy connection string when no real DB is configured.
  // Integration tests mock at the repository layer so the DB is never queried.
  const dbUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://test:test@localhost:5432/test";
  const db = options.db ?? createDb(dbUrl);

  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: "*" }));

  // Build DI container from (potentially mocked) repository factories.
  const container = createContainer(db);

  // Inject DB, DI container + fake auth (bypasses Clerk JWT verification)
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("container", container);
    c.set("userId", userId);
    c.set("requestId", "test-req-id");
    c.set("logger", {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      }),
    } as any);
    await next();
  });

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
  app.route("/api/reports", reportRoutes);
  app.route("/api/fixes", fixRoutes);
  app.route("/api/competitors", competitorRoutes);

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof ServiceError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        err.status as import("hono/utils/http-status").ContentfulStatusCode,
      );
    }
    console.error("Unhandled test error:", err.message);
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: err.message } },
      500,
    );
  });

  const env: Bindings = {
    R2: r2 as any,
    KV: kv as any,
    SEEN_URLS: createKVStub() as any,
    CRAWL_QUEUE: { send: async () => {} } as any,
    REPORT_QUEUE: { send: async () => {} } as any,
    REPORT_SERVICE_URL: "http://localhost:9999",
    BROWSER: null as any,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "mock-secret",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:8787",
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    SHARED_SECRET: "test-secret",
    ANTHROPIC_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key",
    GOOGLE_API_KEY: "test-key",
    PERPLEXITY_API_KEY: "test-key",
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-key",
    CRAWLER_URL: "http://localhost:3000",
    INTEGRATION_ENCRYPTION_KEY: "0".repeat(64),
    GOOGLE_OAUTH_CLIENT_ID: "test-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
    RESEND_API_KEY: "test-key",
    SENTRY_DSN: "",
    APP_BASE_URL: "http://localhost:3000",
    POSTHOG_API_KEY: "",
    BING_API_KEY: "test-key",
    ...options.envOverrides,
  };

  function request(
    path: string,
    init?: RequestInit & { json?: unknown },
  ): Promise<Response> {
    const url = `http://localhost${path}`;
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", "Bearer test-token");
    }
    let body = init?.body;
    if (init?.json) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.json);
    }
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => Promise.resolve(promise),
      passThroughOnException: () => {},
      props: {},
    };
    return app.fetch(
      new Request(url, { ...init, headers, body }),
      env,
      executionCtx,
    ) as Promise<Response>;
  }

  return { app, env, db, kv, r2, request };
}
