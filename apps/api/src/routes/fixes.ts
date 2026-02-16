import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import { createFixGeneratorService } from "../services/fix-generator-service";
import {
  contentFixQueries,
  userQueries,
  projectQueries,
  pageQueries,
  crawlQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const fixRoutes = new Hono<AppEnv>();
fixRoutes.use("*", authMiddleware);

// Simple UUID check (matches standard v4 UUID format)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/fixes/generate — Generate an AI fix for an issue
fixRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    pageId?: string;
    issueCode?: string;
  }>();

  if (!body.projectId || !UUID_RE.test(body.projectId) || !body.issueCode) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId (uuid) and issueCode are required",
        },
      },
      422,
    );
  }

  if (body.pageId && !UUID_RE.test(body.pageId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "pageId must be a valid UUID",
        },
      },
      422,
    );
  }

  try {
    const user = await userQueries(db).getById(userId);
    const project = await projectQueries(db).getById(body.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // Build page context
    let pageContext = {
      url: project.domain,
      title: project.name,
      excerpt: "",
      domain: project.domain,
    };

    if (body.pageId) {
      const page = await pageQueries(db).getById(body.pageId);
      if (page) {
        pageContext = {
          url: page.url,
          title: page.title ?? project.name,
          excerpt: page.metaDesc ?? "",
          domain: project.domain,
        };
      }
    }

    const service = createFixGeneratorService({
      contentFixes: contentFixQueries(db),
    });

    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    const fix = await service.generateFix({
      userId,
      projectId: body.projectId,
      pageId: body.pageId,
      issueCode: body.issueCode,
      context: pageContext,
      apiKey: c.env.ANTHROPIC_API_KEY,
      planLimit: limits.fixesPerMonth,
    });

    return c.json({ data: fix }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /api/fixes/generate-batch — Generate fixes for all supported quick wins
fixRoutes.post("/generate-batch", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    crawlId?: string;
  }>();

  if (
    !body.projectId ||
    !UUID_RE.test(body.projectId) ||
    !body.crawlId ||
    !UUID_RE.test(body.crawlId)
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId and crawlId (uuids) are required",
        },
      },
      422,
    );
  }

  try {
    const user = await userQueries(db).getById(userId);
    const project = await projectQueries(db).getById(body.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const service = createFixGeneratorService({
      contentFixes: contentFixQueries(db),
    });

    const supportedCodes = new Set(service.getSupportedIssueCodes());

    // Fetch quick wins for this crawl
    const crawl = await crawlQueries(db).getById(body.crawlId);
    if (!crawl || crawl.projectId !== body.projectId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Crawl not found" } },
        404,
      );
    }

    // Get quick wins from the crawl's summary data
    const summaryData =
      crawl.summaryData && typeof crawl.summaryData === "object"
        ? (crawl.summaryData as Record<string, unknown>)
        : {};
    const rawWins = Array.isArray(summaryData.quickWins)
      ? summaryData.quickWins
      : [];
    const quickWins: Array<{ code: string; message: string }> = rawWins.filter(
      (w: unknown): w is { code: string; message: string } =>
        typeof w === "object" &&
        w !== null &&
        typeof (w as Record<string, unknown>).code === "string" &&
        typeof (w as Record<string, unknown>).message === "string",
    );

    // Filter to supported codes, deduplicate
    const seen = new Set<string>();
    const toGenerate = quickWins.filter((w) => {
      if (seen.has(w.code) || !supportedCodes.has(w.code)) return false;
      seen.add(w.code);
      return true;
    });

    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    const results: any[] = [];

    for (const win of toGenerate) {
      try {
        const fix = await service.generateFix({
          userId,
          projectId: body.projectId,
          issueCode: win.code,
          context: {
            url: project.domain,
            title: project.name,
            excerpt: "",
            domain: project.domain,
          },
          apiKey: c.env.ANTHROPIC_API_KEY,
          planLimit: limits.fixesPerMonth,
        });
        results.push({ code: win.code, fix, error: null });
      } catch (err: unknown) {
        results.push({
          code: win.code,
          fix: null,
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    }

    const allFailed =
      results.length > 0 && results.every((r) => r.fix === null);
    const someFailed = results.some((r) => r.fix === null);
    const status = allFailed ? 500 : someFailed ? 207 : 201;
    return c.json({ data: results }, status);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/fixes — List fixes for a project
fixRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const fixes = await contentFixQueries(db).listByProject(projectId);
  return c.json({ data: fixes });
});

// GET /api/fixes/supported — List supported issue codes
fixRoutes.get("/supported", async (c) => {
  const service = createFixGeneratorService({
    contentFixes: {
      create: async () => null,
      countByUserThisMonth: async () => 0,
    } as any,
  });
  return c.json({ data: service.getSupportedIssueCodes() });
});
