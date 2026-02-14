import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { getOrCompute } from "../lib/kv-cache";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /stats — aggregate dashboard statistics
// ---------------------------------------------------------------------------

dashboardRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const data = await getOrCompute(
    c.env.KV,
    `dashboard:stats:${userId}`,
    300, // 5 minutes
    async () => {
      const [user, projects, crawlStats] = await Promise.all([
        userQueries(db).getById(userId),
        projectQueries(db).listByUser(userId),
        crawlQueries(db).getStatsForUser(userId),
      ]);

      const limits = PLAN_LIMITS[user?.plan ?? "free"];
      const creditsTotal =
        limits.crawlsPerMonth === Infinity ? 999 : limits.crawlsPerMonth;

      return {
        totalProjects: projects.length,
        totalCrawls: crawlStats.totalCrawls,
        avgScore: crawlStats.avgScore,
        creditsRemaining: user?.crawlCreditsRemaining ?? 0,
        creditsTotal,
      };
    },
  );

  return c.json({ data });
});

// ---------------------------------------------------------------------------
// GET /activity — recent crawl jobs across all user projects
// ---------------------------------------------------------------------------

dashboardRoutes.get("/activity", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Single JOIN + batch score fetch instead of 1 + 10 + 50 sequential queries
  const recentCrawls = await crawlQueries(db).getRecentForUser(userId, 5);

  return c.json({ data: recentCrawls });
});
