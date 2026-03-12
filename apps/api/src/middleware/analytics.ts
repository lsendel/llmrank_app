import type { MiddlewareHandler } from "hono";
import { classifyTraffic } from "@llm-boost/shared";
import { analyticsQueries } from "@llm-boost/db";
import type { AppEnv } from "../index";

const SKIP_PATHS = ["/health", "/favicon.ico", "/robots.txt"];

export function analyticsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    // Skip non-relevant requests
    const method = c.req.method;
    if (method === "OPTIONS" || method === "HEAD") return;

    const path = new URL(c.req.url).pathname;
    if (SKIP_PATHS.some((p) => path.startsWith(p))) return;
    if (path.startsWith("/s/")) return; // snippet serving route

    const userAgent = c.req.header("user-agent") ?? null;
    const referrer = c.req.header("referer") ?? null;
    const classification = classifyTraffic(userAgent, referrer);

    const cf = (c.req.raw as any).cf;
    const country = cf?.country ?? null;
    const botScore = cf?.botManagement?.score ?? null;

    const db = c.get("db");
    const queries = analyticsQueries(db);

    const event =
      classification.sourceType === "ai_bot"
        ? "bot_visit"
        : classification.sourceType === "ai_referral"
          ? "ai_referral"
          : "pageview";

    c.executionCtx.waitUntil(
      queries
        .insertEvent({
          projectId: null, // first-party
          event,
          domain: "llmrank.app",
          path,
          referrer,
          userAgent,
          sourceType: classification.sourceType,
          aiProvider: classification.aiProvider,
          country,
          botScore,
        })
        .catch((err) => console.error("Analytics insert failed:", err)),
    );
  };
}
