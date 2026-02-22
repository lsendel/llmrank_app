import { Hono } from "hono";
import type { AppEnv } from "../index";
import { apiTokenAuth } from "../middleware/api-token-auth";
import { crawlQueries, scoreQueries, visibilityQueries } from "@llm-boost/db";
import { scorePage, type PageData } from "@llm-boost/scoring";
import type { TokenScope, TokenContext } from "../services/api-token-service";
import { z } from "zod";

export const v1Routes = new Hono<AppEnv>();

v1Routes.use("*", apiTokenAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTokenCtx(c: { get(key: "tokenCtx"): TokenContext }): TokenContext {
  return c.get("tokenCtx");
}

function requireProjectAccess(
  tokenCtx: TokenContext,
  projectId: string,
): string | null {
  // Account-wide tokens (null projectId) can access any project
  if (tokenCtx.projectId === null) {
    return null;
  }
  if (tokenCtx.projectId !== projectId) {
    return "Token is not authorized for this project";
  }
  return null;
}

function requireScope(
  tokenCtx: TokenContext,
  scope: TokenScope,
): string | null {
  if (!tokenCtx.scopes.includes(scope)) {
    return `Token is missing required scope: ${scope}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /projects/:id/metrics — Project scores (scope: metrics:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id/metrics", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  // Verify project access
  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  // Verify scope
  const scopeErr = requireScope(tokenCtx, "metrics:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const cq = crawlQueries(db);
  const sq = scoreQueries(db);

  // Get the latest completed crawl for this project
  const latestCrawl = await cq.getLatestByProject(projectId);
  if (!latestCrawl) {
    return c.json({
      data: {
        projectId,
        crawlId: null,
        scores: [],
        summary: null,
      },
    });
  }

  // Get scores for that crawl
  const scores = await sq.listByJob(latestCrawl.id);

  // Aggregate metrics
  const totalPages = scores.length;
  const avgOverall =
    totalPages > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallScore, 0) / totalPages,
        )
      : 0;
  const avgTechnical =
    totalPages > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + (s.technicalScore ?? 0), 0) /
            totalPages,
        )
      : 0;
  const avgContent =
    totalPages > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + (s.contentScore ?? 0), 0) /
            totalPages,
        )
      : 0;
  const avgAiReadiness =
    totalPages > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + (s.aiReadinessScore ?? 0), 0) /
            totalPages,
        )
      : 0;

  return c.json({
    data: {
      projectId,
      crawlId: latestCrawl.id,
      crawlStatus: latestCrawl.status,
      crawledAt: latestCrawl.completedAt ?? latestCrawl.createdAt,
      totalPages,
      averageScores: {
        overall: avgOverall,
        technical: avgTechnical,
        content: avgContent,
        aiReadiness: avgAiReadiness,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /projects/:id/pages — Page scores, paginated (scope: scores:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id/pages", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "scores:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const cq = crawlQueries(db);
  const sq = scoreQueries(db);

  const latestCrawl = await cq.getLatestByProject(projectId);
  if (!latestCrawl) {
    return c.json({
      data: {
        projectId,
        crawlId: null,
        pages: [],
        total: 0,
      },
    });
  }

  // Get page scores with page info
  const pagesWithScores = await sq.listByJobWithPages(latestCrawl.id);

  // Pagination
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;
  const paginated = pagesWithScores.slice(offset, offset + limit);

  return c.json({
    data: {
      projectId,
      crawlId: latestCrawl.id,
      pages: paginated.map((p) => ({
        pageId: p.pageId,
        url: p.page?.url ?? null,
        title: p.page?.title ?? null,
        overallScore: p.overallScore,
        technicalScore: p.technicalScore,
        contentScore: p.contentScore,
        aiReadinessScore: p.aiReadinessScore,
        issueCount: p.issueCount,
      })),
      total: pagesWithScores.length,
      limit,
      offset,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /projects/:id/issues — Issues by severity (scope: scores:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id/issues", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "scores:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const cq = crawlQueries(db);
  const sq = scoreQueries(db);

  const latestCrawl = await cq.getLatestByProject(projectId);
  if (!latestCrawl) {
    return c.json({
      data: {
        projectId,
        crawlId: null,
        issues: [],
        summary: { critical: 0, warning: 0, info: 0 },
      },
    });
  }

  const issues = await sq.getIssuesByJob(latestCrawl.id);

  // Group by severity
  const summary = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    if (issue.severity === "critical") summary.critical++;
    else if (issue.severity === "warning") summary.warning++;
    else if (issue.severity === "info") summary.info++;
  }

  return c.json({
    data: {
      projectId,
      crawlId: latestCrawl.id,
      issues: issues.map((i) => ({
        id: i.id,
        pageId: i.pageId,
        category: i.category,
        severity: i.severity,
        code: i.code,
        message: i.message,
        recommendation: i.recommendation,
      })),
      summary,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /projects/:id/visibility — Visibility results + trends (scope: visibility:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id/visibility", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "visibility:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const vq = visibilityQueries(db);

  const [checks, trends] = await Promise.all([
    vq.listByProject(projectId),
    vq.getTrends(projectId),
  ]);

  return c.json({
    data: {
      projectId,
      checks: checks.map((check) => ({
        id: check.id,
        provider: check.llmProvider,
        query: check.query,
        brandMentioned: check.brandMentioned,
        urlCited: check.urlCited,
        citationPosition: check.citationPosition,
        checkedAt: check.checkedAt,
      })),
      trends,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /score — Lightweight real-time scoring (no crawl needed)
// ---------------------------------------------------------------------------

const scoreInputSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable().optional(),
  content: z.string().optional(),
  metaDescription: z.string().nullable().optional(),
});

v1Routes.post("/score", async (c) => {
  const body = scoreInputSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }

  const { url, title, content, metaDescription } = body.data;
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  const pageData: PageData = {
    url,
    statusCode: 200,
    title: title ?? null,
    metaDescription: metaDescription ?? null,
    canonicalUrl: url,
    wordCount,
    contentHash: "",
    extracted: {
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: [],
      external_links: [],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {},
      structured_data: [],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: null,
      top_transition_words: [],
    },
    lighthouse: null,
    llmScores: null,
  };

  const result = scorePage(pageData);

  return c.json({
    data: {
      url,
      scores: {
        overall: result.overallScore,
        technical: result.technicalScore,
        content: result.contentScore,
        aiReadiness: result.aiReadinessScore,
        performance: result.performanceScore,
        letterGrade: result.letterGrade,
      },
      issues: result.issues.slice(0, 5),
      platformScores: result.platformScores,
    },
  });
});
