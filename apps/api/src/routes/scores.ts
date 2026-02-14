import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCrawlRepository,
  createEnrichmentRepository,
  createPageRepository,
  createProjectRepository,
  createScoreRepository,
} from "../repositories";
import { createPageService } from "../services/page-service";
import { handleServiceError } from "../services/errors";

export const scoreRoutes = new Hono<AppEnv>();

scoreRoutes.use("*", authMiddleware);

function buildPageService(c: Context<AppEnv>) {
  const db = c.get("db");
  return createPageService({
    projects: createProjectRepository(db),
    crawls: createCrawlRepository(db),
    pages: createPageRepository(db),
    scores: createScoreRepository(db),
    enrichments: createEnrichmentRepository(db),
  });
}

// ---------------------------------------------------------------------------
// GET /job/:jobId/pages — List all page scores for a crawl job
// ---------------------------------------------------------------------------

scoreRoutes.get("/job/:jobId/pages", async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const service = buildPageService(c);

  try {
    const data = await service.listPagesForJob(userId, jobId);
    c.header("Cache-Control", "public, max-age=86400, immutable");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /page/:pageId — Single page detail with scores and issues
// ---------------------------------------------------------------------------

scoreRoutes.get("/page/:pageId", async (c) => {
  const userId = c.get("userId");
  const pageId = c.req.param("pageId");
  const service = buildPageService(c);

  try {
    const data = await service.getPage(userId, pageId);
    c.header("Cache-Control", "public, max-age=86400, immutable");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
