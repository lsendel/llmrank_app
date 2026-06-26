import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../lib/error-handler";
import { createFixGeneratorService } from "../services/fix-generator-service";
import {
  contentFixQueries,
  userQueries,
  projectQueries,
  pageQueries,
  crawlQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { parseHtml } from "@llm-boost/parsers";

interface FixPageContext {
  url: string;
  title: string;
  excerpt: string;
  domain: string;
  contentType?: string;
  metaDescription?: string;
  headings?: string[];
  pages?: { url: string; title: string }[];
}

/** Read raw page HTML from R2 (handles gzip), returning null on any failure. */
async function readR2Html(
  r2: R2Bucket,
  key: string | null | undefined,
): Promise<string | null> {
  if (!key) return null;
  try {
    const obj = await r2.get(key);
    if (!obj) return null;
    if (obj.httpMetadata?.contentEncoding === "gzip") {
      const ds = obj.body.pipeThrough(new DecompressionStream("gzip"));
      return await new Response(ds).text();
    }
    return await obj.text();
  } catch {
    return null;
  }
}

/**
 * Build a content-grounded context for the fix generator. Previously this was
 * `{ excerpt: "" }`, which made the LLM emit generic boilerplate. We now pull
 * the page's real HTML from R2 (headings + text excerpt) for page-level fixes,
 * and the crawl's actual page list for project-level fixes (llms.txt, sitemap).
 * Best-effort: any lookup failure degrades to the lighter context, never throws.
 */
async function buildFixContext(args: {
  db: Parameters<typeof pageQueries>[0];
  r2: R2Bucket;
  projectId: string;
  project: { domain: string; name: string };
  pageId?: string;
}): Promise<FixPageContext> {
  const { db, r2, projectId, project, pageId } = args;
  const base: FixPageContext = {
    url: project.domain,
    title: project.name,
    excerpt: "",
    domain: project.domain,
  };

  if (pageId) {
    const page = await pageQueries(db).getById(pageId);
    if (!page) return base;
    const ctx: FixPageContext = {
      url: page.url,
      title: page.title ?? project.name,
      excerpt: page.metaDesc ?? "",
      domain: project.domain,
      contentType: page.contentType ?? undefined,
      metaDescription: page.metaDesc ?? undefined,
    };
    const html = await readR2Html(r2, page.r2RawKey);
    if (html) {
      const parsed = parseHtml(html, page.url);
      const headings = [...parsed.h1, ...parsed.h2, ...parsed.h3].slice(0, 30);
      if (headings.length > 0) ctx.headings = headings;
      if (!ctx.metaDescription && parsed.metaDescription) {
        ctx.metaDescription = parsed.metaDescription;
      }
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) ctx.excerpt = text.slice(0, 2000);
    }
    return ctx;
  }

  // Project-level fix (no page): ground llms.txt / sitemap fixes with the real
  // list of crawled pages instead of an empty document.
  try {
    const latest = await crawlQueries(db).getLatestByProject(projectId);
    if (latest?.id) {
      const rows = await pageQueries(db).listByJob(latest.id, { limit: 30 });
      const pageList = rows.slice(0, 30).map((p) => ({
        url: p.url,
        title: p.title ?? p.url,
      }));
      if (pageList.length > 0) return { ...base, pages: pageList };
    }
  } catch {
    // fall through to base context
  }
  return base;
}

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

    // Build a content-grounded context (real headings/excerpt from R2, or the
    // crawl's page list for project-level fixes) so the LLM isn't guessing.
    const pageContext = await buildFixContext({
      db,
      r2: c.env.R2,
      projectId: body.projectId,
      project,
      pageId: body.pageId,
    });

    const service = createFixGeneratorService({
      contentFixes: contentFixQueries(db),
    });

    const limits =
      PLAN_LIMITS[
        (user?.plan ?? "free") as import("@llm-boost/shared").PlanTier
      ];
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

    const limits =
      PLAN_LIMITS[
        (user?.plan ?? "free") as import("@llm-boost/shared").PlanTier
      ];
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
