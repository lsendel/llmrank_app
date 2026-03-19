import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, crawlJobs } from "@llm-boost/db";
import { type InferSelectModel } from "drizzle-orm";
import { createRegressionService } from "../services/regression-service";
import { createCrawlRepository } from "@llm-boost/repositories";

type CrawlJob = InferSelectModel<typeof crawlJobs>;

export const trendRoutes = new Hono<AppEnv>();
trendRoutes.use("*", authMiddleware);

// GET /api/trends/:projectId?period=30d
trendRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const period = c.req.query("period") ?? "90d";

  // Validate ownership
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Parse period
  const days = parseInt(period) || 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get completed crawls in the period
  const crawls = (await crawlQueries(db).listByProject(
    projectId,
  )) as CrawlJob[];
  const completedCrawls = crawls
    .filter((cr) => cr.status === "complete" && cr.completedAt)
    .filter((cr) => new Date(cr.completedAt!).getTime() >= since.getTime())
    .sort(
      (a, b) =>
        new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
    );

  interface TrendPoint {
    crawlId: string;
    date: string | Date | null;
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
    pageCount: number;
  }
  const trendPoints: TrendPoint[] = [];
  for (const crawl of completedCrawls) {
    if (crawl.summaryData) {
      const sd = crawl.summaryData as Record<string, unknown>;
      const num = (key1: string, key2: string): number => {
        const val1 = sd[key1];
        const val2 = sd[key2];
        if (typeof val1 === "number") return val1;
        if (typeof val2 === "number") return val2;
        return 0;
      };
      trendPoints.push({
        crawlId: crawl.id,
        date: crawl.completedAt,
        overall: num("overallScore", "overall"),
        technical: num("technicalScore", "technical"),
        content: num("contentScore", "content"),
        aiReadiness: num("aiReadinessScore", "aiReadiness"),
        performance: num("performanceScore", "performance"),
        letterGrade: typeof sd.letterGrade === "string" ? sd.letterGrade : "F",
        pageCount: crawl.pagesScored ?? 0,
      });
    }
  }

  // Compute deltas between consecutive points
  const withDeltas = trendPoints.map((point, i) => {
    if (i === 0) return { ...point, deltas: null };
    const prev = trendPoints[i - 1];
    return {
      ...point,
      deltas: {
        overall: point.overall - prev.overall,
        technical: point.technical - prev.technical,
        content: point.content - prev.content,
        aiReadiness: point.aiReadiness - prev.aiReadiness,
        performance: point.performance - prev.performance,
      },
    };
  });

  return c.json({
    data: {
      projectId,
      period,
      points: withDeltas,
    },
  });
});

// GET /api/trends/:projectId/regressions — Detect regressions for a project
trendRoutes.get("/:projectId/regressions", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const svc = createRegressionService({
    crawls: createCrawlRepository(db),
    notifications: { create: async () => ({}) },
  });

  const regressions = await svc.detectRegressions({ projectId });
  return c.json({ data: regressions });
});
