import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
} from "../repositories";
import { createCrawlService } from "../services/crawl-service";
import { handleServiceError } from "../services/errors";
import { rateLimit } from "../middleware/rate-limit";

export const crawlRoutes = new Hono<AppEnv>();

// All crawl routes require authentication
crawlRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST / — Start a new crawl
// ---------------------------------------------------------------------------

crawlRoutes.post(
  "/",
  rateLimit({ limit: 10, windowSeconds: 3600, keyPrefix: "rl:crawl" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");

    const body = await c.req.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return c.json(
        {
          error: { code: "VALIDATION_ERROR", message: "projectId is required" },
        },
        422,
      );
    }

    const service = createCrawlService({
      crawls: createCrawlRepository(db),
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      scores: createScoreRepository(db),
    });

    try {
      const crawlJob = await service.requestCrawl({
        userId,
        projectId,
        requestUrl: c.req.url,
        env: {
          crawlerUrl: c.env.CRAWLER_URL,
          sharedSecret: c.env.SHARED_SECRET,
          kv: c.env.KV,
        },
      });
      return c.json({ data: crawlJob }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — Get crawl status and progress
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.getCrawl(userId, crawlId);
    if ("status" in data && data.status === "complete") {
      c.header("Cache-Control", "public, max-age=86400, immutable");
    } else {
      c.header("Cache-Control", "private, max-age=10");
    }
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /project/:projectId — List crawls for a project
// ---------------------------------------------------------------------------

crawlRoutes.get("/project/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const crawls = await service.listProjectCrawls(userId, projectId);
    return c.json({
      data: crawls,
      pagination: { page: 1, limit: 50, total: crawls.length, totalPages: 1 },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/quick-wins — Top 5 highest-impact, easiest-to-fix issues
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/quick-wins", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const wins = await service.getQuickWins(userId, crawlId);
    return c.json({ data: wins });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/platform-readiness — Pass/fail per AI platform
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/platform-readiness", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.getPlatformReadiness(userId, crawlId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/share — Enable sharing, generate token
// ---------------------------------------------------------------------------

crawlRoutes.post("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.enableSharing(userId, crawlId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/share — Disable sharing
// ---------------------------------------------------------------------------

crawlRoutes.delete("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.disableSharing(userId, crawlId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
