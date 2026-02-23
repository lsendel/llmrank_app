import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationSchema,
} from "@llm-boost/shared";
import { handleServiceError } from "../services/errors";
import {
  toProjectResponse,
  toProjectDetailResponse,
  toProjectListResponse,
} from "../dto/project.dto";
import {
  visibilityQueries,
  personaQueries,
  reportQueries,
  scheduledVisibilityQueryQueries,
  projectQueries,
  competitorQueries,
} from "@llm-boost/db";

export const projectRoutes = new Hono<AppEnv>();

// All project routes require authentication
projectRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — List user's projects (paginated)
// ---------------------------------------------------------------------------

projectRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const query = PaginationSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  if (!query.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid pagination parameters",
          details: query.error.flatten(),
        },
      },
      422,
    );
  }

  const { projectService } = c.get("container");

  try {
    const result = await projectService.listForUser(userId, query.data);
    return c.json({
      ...result,
      data: toProjectListResponse(result.data),
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create a new project
// ---------------------------------------------------------------------------

projectRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const { projectService } = c.get("container");

  try {
    const project = await projectService.createProject(userId, parsed.data);
    return c.json({ data: toProjectResponse(project) }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get project detail with latest crawl
// ---------------------------------------------------------------------------

projectRoutes.get("/:id", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { projectService } = c.get("container");

  try {
    const data = await projectService.getProjectDetail(userId, projectId);
    return c.json({ data: toProjectDetailResponse(data) });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update project
// ---------------------------------------------------------------------------

projectRoutes.put("/:id", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const body = await c.req.json();
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid update data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const { projectService } = c.get("container");

  try {
    const updated = await projectService.updateProject(
      userId,
      projectId,
      parsed.data,
    );
    return c.json({ data: toProjectResponse(updated) });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Soft delete
// ---------------------------------------------------------------------------

projectRoutes.delete("/:id", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { projectService } = c.get("container");

  try {
    const result = await projectService.deleteProject(userId, projectId);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/progress — Cross-crawl improvement progress
// ---------------------------------------------------------------------------

projectRoutes.get("/:id/progress", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { progressService } = c.get("container");

  try {
    const data = await progressService.getProjectProgress(userId, projectId);
    if (!data) {
      return c.json({
        data: null,
        message: "Need at least 2 completed crawls",
      });
    }
    c.header("Cache-Control", "private, max-age=300");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/checklist-status — Onboarding checklist completion data
// ---------------------------------------------------------------------------

projectRoutes.get(
  "/:id/checklist-status",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const [visChecks, personaCount, reports, scheduleCount] = await Promise.all(
      [
        visibilityQueries(db).listByProject(projectId),
        personaQueries(db).countByProject(projectId),
        reportQueries(db).listByProject(projectId),
        scheduledVisibilityQueryQueries(db).countByProject(projectId),
      ],
    );

    return c.json({
      data: {
        visibilityCount: visChecks.length,
        personaCount,
        reportCount: reports.length,
        scheduleCount,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// PATCH /:id/site-context — Update site description and industry
// ---------------------------------------------------------------------------

projectRoutes.patch(
  "/:id/site-context",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const body = await c.req.json<{
      siteDescription?: string;
      industry?: string;
    }>();

    await projectQueries(db).update(projectId, {
      ...(body.siteDescription !== undefined && {
        siteDescription: body.siteDescription,
      }),
      ...(body.industry !== undefined && { industry: body.industry }),
    });

    return c.json({ data: { success: true } });
  },
);

// ---------------------------------------------------------------------------
// POST /:id/rerun-auto-generation — Re-trigger all auto-generation services
// ---------------------------------------------------------------------------

projectRoutes.post(
  "/:id/rerun-auto-generation",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");
    const { crawlQueries } = await import("@llm-boost/db");
    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);

    if (!latestCrawl || latestCrawl.status !== "complete") {
      return c.json(
        { error: { code: "NO_CRAWL", message: "No completed crawl found" } },
        400,
      );
    }

    const jobId = latestCrawl.id;
    const promises: Promise<unknown>[] = [];

    // Auto site description
    if (c.env.ANTHROPIC_API_KEY) {
      const { runAutoSiteDescription } =
        await import("../services/auto-site-description-service");
      promises.push(
        runAutoSiteDescription({
          databaseUrl: c.env.DATABASE_URL,
          projectId,
          crawlJobId: jobId,
          anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        }).catch((e) => console.error("auto-site-description failed:", e)),
      );
    }

    // Auto personas
    if (c.env.ANTHROPIC_API_KEY) {
      const { runAutoPersonaGeneration } =
        await import("../services/auto-persona-service");
      promises.push(
        runAutoPersonaGeneration({
          databaseUrl: c.env.DATABASE_URL,
          projectId,
          anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        }).catch((e) => console.error("auto-persona failed:", e)),
      );
    }

    // Auto keywords
    if (c.env.ANTHROPIC_API_KEY) {
      const { runAutoKeywordGeneration } =
        await import("../services/auto-keyword-service");
      promises.push(
        runAutoKeywordGeneration({
          databaseUrl: c.env.DATABASE_URL,
          projectId,
          crawlJobId: jobId,
          anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        }).catch((e) => console.error("auto-keyword failed:", e)),
      );
    }

    // Auto competitors (runs after site description, give it a head start)
    if (c.env.ANTHROPIC_API_KEY) {
      const { runAutoCompetitorDiscovery } =
        await import("../services/auto-competitor-service");
      promises.push(
        runAutoCompetitorDiscovery({
          databaseUrl: c.env.DATABASE_URL,
          projectId,
          anthropicApiKey: c.env.ANTHROPIC_API_KEY,
          perplexityApiKey: c.env.PERPLEXITY_API_KEY,
          grokApiKey: c.env.XAI_API_KEY,
        }).catch((e) => console.error("auto-competitor failed:", e)),
      );
    }

    const results = await Promise.allSettled(promises);
    const summary = results.map((r, i) => ({
      service: ["site-description", "personas", "keywords", "competitors"][i],
      status: r.status,
      error: r.status === "rejected" ? String(r.reason) : undefined,
    }));
    return c.json({ data: { status: "complete", services: summary } });
  },
);

// ---------------------------------------------------------------------------
// POST /:id/rediscover-competitors — Re-run competitor discovery
// ---------------------------------------------------------------------------

projectRoutes.post(
  "/:id/rediscover-competitors",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    // Clear existing auto-discovered competitors
    const existing = await competitorQueries(db).listByProject(projectId);
    for (const comp of existing) {
      if (comp.source === "auto_discovered") {
        await competitorQueries(db).remove(comp.id);
      }
    }

    const { runAutoCompetitorDiscovery } =
      await import("../services/auto-competitor-service");

    const promise = runAutoCompetitorDiscovery({
      databaseUrl: c.env.DATABASE_URL,
      projectId,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      perplexityApiKey: c.env.PERPLEXITY_API_KEY,
      grokApiKey: c.env.XAI_API_KEY,
    });

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(promise.catch(() => {}));
      return c.json({ data: { status: "discovering" } }, 202);
    }

    await promise;
    return c.json({ data: { status: "complete" } });
  },
);
