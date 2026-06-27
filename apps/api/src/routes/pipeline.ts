import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import {
  competitorQueries,
  crawlQueries,
  pipelineRunQueries,
  projectQueries,
  savedKeywordQueries,
  scoreQueries,
  userQueries,
} from "@llm-boost/db";
import {
  buildHealthCheckResult,
  createRecommendationsService,
} from "@llm-boost/pipeline";

export const pipelineRoutes = new Hono<AppEnv>();

// GET /:projectId — List pipeline runs for a project
pipelineRoutes.get(
  "/:projectId",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const db = c.get("db");
    const projectId = c.req.param("projectId");
    const runs = await pipelineRunQueries(db).listByProject(projectId);

    return c.json({
      data: runs.map((r) => ({
        id: r.id,
        status: r.status,
        currentStep: r.currentStep,
        stepResults: r.stepResults,
        startedAt: r.startedAt ?? null,
        completedAt: r.completedAt ?? null,
        createdAt: r.createdAt,
      })),
    });
  },
);

// GET /:projectId/latest — Get latest pipeline run
pipelineRoutes.get(
  "/:projectId/latest",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const db = c.get("db");
    const projectId = c.req.param("projectId");
    const run = await pipelineRunQueries(db).getLatestByProject(projectId);

    if (!run) return c.json({ data: null });

    return c.json({
      data: {
        id: run.id,
        status: run.status,
        currentStep: run.currentStep,
        stepResults: run.stepResults,
        startedAt: run.startedAt ?? null,
        completedAt: run.completedAt ?? null,
        createdAt: run.createdAt,
      },
    });
  },
);

// PATCH /:projectId/settings — Update pipeline settings
pipelineRoutes.patch(
  "/:projectId/settings",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const db = c.get("db");
    const projectId = c.req.param("projectId");
    const body = await c.req.json<Record<string, unknown>>();
    const project = c.get("project") as { pipelineSettings?: unknown };

    const existing = (project.pipelineSettings ?? {}) as Record<
      string,
      unknown
    >;
    const merged = { ...existing, ...body };

    await projectQueries(db).update(projectId, { pipelineSettings: merged });

    return c.json({ data: merged });
  },
);

// GET /:projectId/health-check — Run health check on project settings
pipelineRoutes.get(
  "/:projectId/health-check",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("projectId");
    const db = c.get("db");
    const project = c.get("project") as {
      userId: string;
      crawlSchedule?: string | null;
    };

    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);

    if (!latestCrawl || latestCrawl.status !== "complete") {
      return c.json(
        { error: { code: "NO_CRAWL", message: "No completed crawl found" } },
        400,
      );
    }

    const [user, keywordCount, competitors, issues] = await Promise.all([
      userQueries(db).getById(project.userId),
      savedKeywordQueries(db).countByProject(projectId),
      competitorQueries(db).listByProject(projectId),
      scoreQueries(db).getIssuesByJob(latestCrawl.id),
    ]);

    const result = buildHealthCheckResult({
      projectId,
      crawlJobId: latestCrawl.id,
      project,
      user: user ?? null,
      keywordCount,
      competitors,
      issues,
    });

    return c.json({ data: result });
  },
);

// GET /:projectId/recommendations — Next best actions for dashboard
pipelineRoutes.get(
  "/:projectId/recommendations",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const db = c.get("db");
    const projectId = c.req.param("projectId");
    const service = createRecommendationsService(db);
    const recommendations = await service.getForProject(projectId);
    return c.json({ data: recommendations });
  },
);
