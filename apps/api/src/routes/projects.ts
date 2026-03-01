import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationSchema,
} from "@llm-boost/shared";
import { z } from "zod";
import { handleServiceError } from "../services/errors";
import { createAuditService } from "../services/audit-service";
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
  pageQueries,
  scoreQueries,
  contentFixQueries,
  crawlQueries,
  adminQueries,
} from "@llm-boost/db";

export const projectRoutes = new Hono<AppEnv>();

// All project routes require authentication
projectRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — List user's projects (paginated)
// ---------------------------------------------------------------------------

projectRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const ListProjectsQuerySchema = PaginationSchema.extend({
    q: z.string().trim().max(120).optional(),
    sort: z
      .enum([
        "activity_desc",
        "score_desc",
        "score_asc",
        "name_asc",
        "name_desc",
        "created_desc",
        "created_asc",
      ])
      .default("activity_desc"),
    health: z
      .enum([
        "all",
        "good",
        "needs_work",
        "poor",
        "no_crawl",
        "in_progress",
        "failed",
      ])
      .default("all"),
  });

  const query = ListProjectsQuerySchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
    q: c.req.query("q"),
    sort: c.req.query("sort"),
    health: c.req.query("health"),
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

  // Blocklist check
  let blocked = false;
  try {
    const adminQ = adminQueries(c.get("db"));
    blocked = await adminQ.isBlocked(parsed.data.domain);
  } catch (error) {
    const logger = c.get("logger");
    logger?.warn("Failed to evaluate blocked-domain list for project create", {
      domain: parsed.data.domain,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (blocked) {
    return c.json(
      {
        error: {
          code: "DOMAIN_BLOCKED",
          message: "This domain cannot be crawled",
        },
      },
      403,
    );
  }

  const { projectService } = c.get("container");

  try {
    const project = await projectService.createProject(userId, parsed.data);
    createAuditService(c.get("db"))
      .emitEvent({
        action: "project.created",
        actorId: userId,
        resourceType: "project",
        resourceId: project.id,
      })
      .catch(() => {});
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
    createAuditService(c.get("db"))
      .emitEvent({
        action: "project.updated",
        actorId: userId,
        resourceType: "project",
        resourceId: projectId,
      })
      .catch(() => {});
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
    createAuditService(c.get("db"))
      .emitEvent({
        action: "project.deleted",
        actorId: userId,
        resourceType: "project",
        resourceId: projectId,
      })
      .catch(() => {});
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
        siteDescriptionSource: "user",
      }),
      ...(body.industry !== undefined && {
        industry: body.industry,
        industrySource: "user",
      }),
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

    const { createPipelineService } =
      await import("../services/pipeline-service");
    const { createAuditService } = await import("../services/audit-service");

    const audit = createAuditService(db);
    const pipeline = createPipelineService(db, audit, {
      databaseUrl: c.env.DATABASE_URL,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      perplexityApiKey: c.env.PERPLEXITY_API_KEY,
      grokApiKey: c.env.XAI_API_KEY,
      reportServiceUrl: c.env.REPORT_SERVICE_URL,
      sharedSecret: c.env.SHARED_SECRET,
    });

    const run = await pipeline.start(projectId, latestCrawl.id);
    return c.json({
      data: { pipelineRunId: run?.id, status: run?.status },
    });
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

// ---------------------------------------------------------------------------
// GET /:id/fixes/:issueId/recommendation — Fix recommendation for an issue
// (Used by MCP tool: get_fix_recommendation)
// ---------------------------------------------------------------------------

projectRoutes.get(
  "/:id/fixes/:issueId/recommendation",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const issueId = c.req.param("issueId");
    const db = c.get("db");

    // Find the issue and its existing recommendation
    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
    if (!latestCrawl) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No crawl data available" } },
        404,
      );
    }

    const jobIssues = await scoreQueries(db).getIssuesByJob(latestCrawl.id);
    const issue = jobIssues.find((i) => i.id === issueId);
    if (!issue) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Issue not found" } },
        404,
      );
    }

    // Check for a generated content fix
    const fixes = await contentFixQueries(db).listByProject(projectId);
    const generatedFix = fixes.find((f) => f.issueCode === issue.code);

    return c.json({
      data: {
        issueId: issue.id,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        recommendation: issue.recommendation,
        pageUrl: issue.pageUrl,
        generatedFix: generatedFix
          ? {
              id: generatedFix.id,
              content: generatedFix.generatedFix,
              status: generatedFix.status,
              createdAt: generatedFix.createdAt,
            }
          : null,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /:id/pages/:pageId/suggest-meta — AI meta tag suggestions
// (Used by MCP tool: suggest_meta_tags)
// ---------------------------------------------------------------------------

projectRoutes.post(
  "/:id/pages/:pageId/suggest-meta",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const pageId = c.req.param("pageId");
    const db = c.get("db");

    const page = await pageQueries(db).getById(pageId);
    if (!page || page.projectId !== projectId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Page not found" } },
        404,
      );
    }

    const project = await projectQueries(db).getById(projectId);
    const { issues } = await scoreQueries(db).getByPageWithIssues(pageId);

    const metaIssues = issues.filter(
      (i) =>
        i.code === "MISSING_TITLE" ||
        i.code === "TITLE_TOO_SHORT" ||
        i.code === "TITLE_TOO_LONG" ||
        i.code === "MISSING_META_DESC" ||
        i.code === "META_DESC_TOO_SHORT" ||
        i.code === "META_DESC_TOO_LONG" ||
        i.code === "MISSING_OG_TAGS",
    );

    return c.json({
      data: {
        pageId,
        url: page.url,
        current: {
          title: page.title,
          metaDescription: page.metaDesc,
        },
        issues: metaIssues.map((i) => ({
          code: i.code,
          message: i.message,
          recommendation: i.recommendation,
        })),
        context: {
          domain: project?.domain,
          siteDescription: project?.siteDescription,
          industry: project?.industry,
          wordCount: page.wordCount,
        },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /:id/technical/llms-txt — llms.txt validation status
// (Used by MCP tool: check_llms_txt)
// ---------------------------------------------------------------------------

projectRoutes.get(
  "/:id/technical/llms-txt",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
    if (!latestCrawl) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No crawl data available" } },
        404,
      );
    }

    const jobIssues = await scoreQueries(db).getIssuesByJob(latestCrawl.id);
    const llmsTxtIssues = jobIssues.filter(
      (i) =>
        i.code === "MISSING_LLMS_TXT" ||
        i.code === "INVALID_LLMS_TXT" ||
        i.code === "INCOMPLETE_LLMS_TXT",
    );

    const project = await projectQueries(db).getById(projectId);

    return c.json({
      data: {
        domain: project?.domain,
        hasLlmsTxt: llmsTxtIssues.length === 0,
        issues: llmsTxtIssues.map((i) => ({
          code: i.code,
          severity: i.severity,
          message: i.message,
          recommendation: i.recommendation,
        })),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /:id/pages/:pageId/schema-validation — Schema markup validation
// (Used by MCP tool: validate_schema)
// ---------------------------------------------------------------------------

projectRoutes.get(
  "/:id/pages/:pageId/schema-validation",
  withOwnership("project"),
  async (c) => {
    const projectId = c.req.param("id");
    const pageId = c.req.param("pageId");
    const db = c.get("db");

    const page = await pageQueries(db).getById(pageId);
    if (!page || page.projectId !== projectId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Page not found" } },
        404,
      );
    }

    const { issues } = await scoreQueries(db).getByPageWithIssues(pageId);

    const schemaIssues = issues.filter(
      (i) =>
        i.code === "MISSING_SCHEMA" ||
        i.code === "INVALID_SCHEMA" ||
        i.code === "INCOMPLETE_SCHEMA" ||
        i.code === "MISSING_STRUCTURED_DATA",
    );

    return c.json({
      data: {
        pageId,
        url: page.url,
        hasStructuredData: schemaIssues.length === 0,
        issues: schemaIssues.map((i) => ({
          code: i.code,
          severity: i.severity,
          message: i.message,
          recommendation: i.recommendation,
          data: i.data,
        })),
      },
    });
  },
);
