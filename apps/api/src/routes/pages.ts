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

export const pageRoutes = new Hono<AppEnv>();

// All page routes require authentication
pageRoutes.use("*", authMiddleware);

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
// GET /:id — Page detail with scores and issues
// ---------------------------------------------------------------------------

pageRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const pageId = c.req.param("id");
  const service = buildPageService(c);

  try {
    const data = await service.getPage(userId, pageId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /job/:jobId — List all pages for a crawl job
// ---------------------------------------------------------------------------

pageRoutes.get("/job/:jobId", async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const service = buildPageService(c);

  try {
    const data = await service.listPagesForJob(userId, jobId);
    return c.json({
      data,
      pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /issues/job/:jobId — List all issues for a crawl job
// ---------------------------------------------------------------------------

pageRoutes.get("/issues/job/:jobId", async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const service = buildPageService(c);

  try {
    const data = await service.listIssues(userId, jobId);
    return c.json({
      data,
      pagination: { page: 1, limit: 500, total: data.length, totalPages: 1 },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/enrichments — Get integration enrichment data for a page
// ---------------------------------------------------------------------------

pageRoutes.get("/:id/enrichments", async (c) => {
  const userId = c.get("userId");
  const pageId = c.req.param("id");
  const service = buildPageService(c);

  try {
    const data = await service.listEnrichments(userId, pageId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
