import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createPageRepository,
  createEnrichmentRepository,
  createVisibilityRepository,
} from "../repositories";
import { createInsightsService } from "../services/insights-service";
import { createIntelligenceService } from "../services/intelligence-service";
import { handleServiceError } from "../services/errors";

export const insightsRoutes = new Hono<AppEnv>();

insightsRoutes.use("*", authMiddleware);

// GET /api/crawls/:crawlId/insights
insightsRoutes.get("/:crawlId/insights", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createInsightsService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
  });

  try {
    const data = await service.getInsights(userId, crawlId);
    c.header("Cache-Control", "private, max-age=3600");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/crawls/:crawlId/issue-heatmap
insightsRoutes.get("/:crawlId/issue-heatmap", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createInsightsService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
  });

  try {
    const data = await service.getIssueHeatmap(userId, crawlId);
    c.header("Cache-Control", "private, max-age=3600");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/crawls/:crawlId/fused-insights
insightsRoutes.get("/:crawlId/fused-insights", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createIntelligenceService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
    enrichments: createEnrichmentRepository(db),
    visibility: createVisibilityRepository(db),
  });

  try {
    const data = await service.getFusedInsights(userId, crawlId);
    c.header("Cache-Control", "private, max-age=300");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
