import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../index";
import { createAuth } from "../lib/auth";
import { authMiddleware } from "../middleware/auth";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => {
  return c.json({ status: "ok" });
});

healthRoutes.get("/auth-check", authMiddleware, async (c) => {
  const hasAuthSecret = !!c.env.BETTER_AUTH_SECRET;

  let dbStatus: string;
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1` as any);
    dbStatus = "connected";
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  let authStatus: string;
  try {
    const auth = createAuth(c.env);
    authStatus = auth ? "configured" : "not configured";
  } catch (e) {
    authStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return c.json({
    authProvider: "better-auth",
    authSecretConfigured: hasAuthSecret,
    authStatus,
    dbStatus,
  });
});

healthRoutes.get("/deep", async (c) => {
  const logger = c.var.logger;
  const startTime = Date.now();
  const checks: Record<
    string,
    {
      status: "healthy" | "degraded" | "down";
      latency?: number;
      error?: string;
      details?: Record<string, unknown>;
    }
  > = {};

  // Check Database
  const dbStart = Date.now();
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1` as any);
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: "down",
      latency: Date.now() - dbStart,
      error: error instanceof Error ? error.message : String(error),
    };
    logger.error("Database health check failed", { error });
  }

  // Check R2 Storage
  const r2Start = Date.now();
  try {
    await c.env.R2.head("healthcheck"); // Non-existent key is fine, just testing connectivity
    checks.r2_storage = { status: "healthy", latency: Date.now() - r2Start };
  } catch (error) {
    // R2.head returns null for non-existent keys, only errors indicate connectivity issues
    if (error instanceof Error && !error.message.includes("not found")) {
      checks.r2_storage = {
        status: "down",
        latency: Date.now() - r2Start,
        error: error.message,
      };
      logger.error("R2 health check failed", { error: error.message });
    } else {
      checks.r2_storage = { status: "healthy", latency: Date.now() - r2Start };
    }
  }

  // Check KV Cache
  const kvStart = Date.now();
  try {
    await c.env.KV.get("healthcheck");
    checks.kv_cache = { status: "healthy", latency: Date.now() - kvStart };
  } catch (error) {
    checks.kv_cache = {
      status: "down",
      latency: Date.now() - kvStart,
      error: error instanceof Error ? error.message : String(error),
    };
    logger.error("KV health check failed", { error });
  }

  // Check Crawler Service
  const crawlerStart = Date.now();
  try {
    const response = await fetch(`${c.env.CRAWLER_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      checks.crawler_service = {
        status: "healthy",
        latency: Date.now() - crawlerStart,
      };
    } else {
      checks.crawler_service = {
        status: "degraded",
        latency: Date.now() - crawlerStart,
        details: { status_code: response.status },
      };
    }
  } catch (error) {
    checks.crawler_service = {
      status: "down",
      latency: Date.now() - crawlerStart,
      error: error instanceof Error ? error.message : String(error),
    };
    logger.warn("Crawler service health check failed", { error });
  }

  // Check Anthropic API
  const anthropicStart = Date.now();
  try {
    // Just test authentication, not actual API call
    const hasKey =
      !!c.env.ANTHROPIC_API_KEY && c.env.ANTHROPIC_API_KEY.length > 0;
    checks.anthropic_llm = {
      status: hasKey ? "healthy" : "degraded",
      latency: Date.now() - anthropicStart,
      details: { configured: hasKey },
    };
  } catch (error) {
    checks.anthropic_llm = {
      status: "down",
      latency: Date.now() - anthropicStart,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Check OpenAI API
  const openaiStart = Date.now();
  try {
    const hasKey = !!c.env.OPENAI_API_KEY && c.env.OPENAI_API_KEY.length > 0;
    checks.openai_llm = {
      status: hasKey ? "healthy" : "degraded",
      latency: Date.now() - openaiStart,
      details: { configured: hasKey },
    };
  } catch (error) {
    checks.openai_llm = {
      status: "down",
      latency: Date.now() - openaiStart,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Determine overall status
  const hasDown = Object.values(checks).some((c) => c.status === "down");
  const hasDegraded = Object.values(checks).some(
    (c) => c.status === "degraded",
  );

  let overallStatus: "healthy" | "degraded" | "down";
  if (hasDown) {
    overallStatus = "down";
  } else if (hasDegraded) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  const totalTime = Date.now() - startTime;

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      total_latency_ms: totalTime,
      checks,
    },
    overallStatus === "down" ? 503 : overallStatus === "degraded" ? 200 : 200,
  );
});
