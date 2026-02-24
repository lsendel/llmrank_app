import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS, type ReportConfig } from "@llm-boost/shared";
import { getOrCompute } from "../lib/kv-cache";
import {
  aggregateReportData,
  fetchReportData,
  type GenerateReportJob,
  type ReportData,
} from "@llm-boost/reports";
import { createRecommendationsService } from "../services/recommendations-service";

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
      const [user, projects, crawlStats, latestCrawl] = await Promise.all([
        userQueries(db).getById(userId),
        projectQueries(db).listByUser(userId),
        crawlQueries(db).getStatsForUser(userId),
        crawlQueries(db).getRecentForUser(userId, 1),
      ]);

      const limits = PLAN_LIMITS[user?.plan ?? "free"];
      const creditsTotal =
        limits.crawlsPerMonth === Infinity ? 999 : limits.crawlsPerMonth;

      let latestInsights: {
        quickWins: ReportData["quickWins"];
        coverage: ReportData["readinessCoverage"];
        scoreDeltas: ReportData["scoreDeltas"];
      } | null = null;

      const newestCrawl = latestCrawl[0];
      if (newestCrawl && newestCrawl.status === "complete") {
        try {
          const job: GenerateReportJob = {
            reportId: "dashboard-preview",
            projectId: newestCrawl.projectId,
            crawlJobId: newestCrawl.id,
            userId,
            type: "detailed",
            format: "pdf",
            config: {} as ReportConfig,
          };
          const raw = await fetchReportData(db, job);
          const aggregated = aggregateReportData(raw, {
            type: "detailed",
          });
          latestInsights = {
            quickWins: aggregated.quickWins.slice(0, 3),
            coverage: aggregated.readinessCoverage.slice(0, 3),
            scoreDeltas: aggregated.scoreDeltas,
          };
        } catch (error) {
          console.error("Failed to compute dashboard insights", error);
        }
      }

      return {
        totalProjects: projects.length,
        totalCrawls: crawlStats.totalCrawls,
        avgScore: crawlStats.avgScore,
        creditsRemaining: user?.crawlCreditsRemaining ?? 0,
        creditsTotal,
        latestInsights,
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

// ---------------------------------------------------------------------------
// GET /priority-feed — cross-project prioritized opportunities and risks
// ---------------------------------------------------------------------------

dashboardRoutes.get("/priority-feed", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 15, 1), 50);

  const service = createRecommendationsService(db);
  const data = await service.getPortfolioPriorityFeed(userId, { limit });

  return c.json({
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      count: data.length,
      limit,
    },
  });
});
