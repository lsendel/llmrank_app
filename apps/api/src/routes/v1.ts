import { Hono } from "hono";
import type { AppEnv } from "../index";
import { apiTokenAuth } from "../middleware/api-token-auth";
import {
  crawlQueries,
  projectQueries,
  scoreQueries,
  visibilityQueries,
  savedKeywordQueries,
  actionItemQueries,
} from "@llm-boost/db";
import {
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
  createCompetitorRepository,
} from "../repositories";
import { createVisibilityService } from "../services/visibility-service";
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

// ---------------------------------------------------------------------------
// GET /projects/:id — Project detail with latest crawl (scope: projects:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "projects:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const pq = projectQueries(db);
  const cq = crawlQueries(db);
  const sq = scoreQueries(db);

  const project = await pq.getById(projectId);
  if (!project) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const latestCrawl = await cq.getLatestByProject(projectId);
  let latestCrawlData = null;

  if (latestCrawl) {
    const scores = await sq.listByJob(latestCrawl.id);
    const totalPages = scores.length;
    const avg = (fn: (s: (typeof scores)[0]) => number | null) =>
      totalPages > 0
        ? Math.round(
            scores.reduce((sum, s) => sum + (fn(s) ?? 0), 0) / totalPages,
          )
        : null;

    latestCrawlData = {
      overallScore: avg((s) => s.overallScore),
      technicalScore: avg((s) => s.technicalScore),
      contentScore: avg((s) => s.contentScore),
      aiReadinessScore: avg((s) => s.aiReadinessScore),
      completedAt: latestCrawl.completedAt ?? null,
      pagesScored: totalPages,
    };
  }

  return c.json({
    data: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      latestCrawl: latestCrawlData,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /projects/:id/visibility/check — Trigger visibility check (scope: visibility:write)
// ---------------------------------------------------------------------------

v1Routes.post("/projects/:id/visibility/check", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "visibility:write");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const db = c.get("db");
  const pq = projectQueries(db);
  const project = await pq.getById(projectId);
  if (!project) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Resolve keywords for this project
  const kwRepo = savedKeywordQueries(db);
  const allKeywords = await kwRepo.listByProject(projectId);
  if (allKeywords.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No keywords configured for this project",
        },
      },
      422,
    );
  }

  const defaultProviders = ["chatgpt", "claude", "gemini", "perplexity"];

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  const allResults = [];
  for (const keyword of allKeywords.slice(0, 5)) {
    const stored = await service.runCheck({
      userId: tokenCtx.userId,
      projectId,
      query: keyword.keyword,
      keywordId: keyword.id,
      providers: defaultProviders,
      apiKeys: {
        chatgpt: c.env.OPENAI_API_KEY,
        claude: c.env.ANTHROPIC_API_KEY,
        perplexity: c.env.PERPLEXITY_API_KEY,
        gemini: c.env.GOOGLE_API_KEY,
        copilot: c.env.BING_API_KEY,
        gemini_ai_mode: c.env.GOOGLE_API_KEY,
        grok: c.env.XAI_API_KEY,
      },
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    });
    allResults.push(...stored);
  }

  return c.json({ checkId: allResults[0]?.id ?? "", status: "queued" }, 201);
});

// ---------------------------------------------------------------------------
// POST /crawls — Trigger a new crawl (scope: crawls:write)
// ---------------------------------------------------------------------------

v1Routes.post("/crawls", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);

  const scopeErr = requireScope(tokenCtx, "crawls:write");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }
  const { projectId } = body as { projectId: string };
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required",
        },
      },
      422,
    );
  }

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const { crawlService } = c.get("container");

  const crawlJob = await crawlService.requestCrawl({
    userId: tokenCtx.userId,
    projectId,
    requestUrl: c.req.url,
    env: {
      crawlerUrl: c.env.CRAWLER_URL,
      sharedSecret: c.env.SHARED_SECRET,
      kv: c.env.KV,
    },
  });

  return c.json(
    {
      data: {
        id: crawlJob.id,
        projectId: crawlJob.projectId,
        status: crawlJob.status,
        pagesScored: crawlJob.pagesScored ?? null,
        startedAt: crawlJob.startedAt ?? null,
      },
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// GET /projects/:id/keywords/opportunities — Keyword opportunities (scope: scores:read)
// ---------------------------------------------------------------------------

v1Routes.get("/projects/:id/keywords/opportunities", async (c) => {
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
  const kwRepo = savedKeywordQueries(db);
  const allKeywords = await kwRepo.listByProject(projectId);

  const keywords = allKeywords.map((k) => ({
    keyword: k.keyword,
    position: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    source: k.source ?? "manual",
  }));

  return c.json({ keywords, total: keywords.length });
});

// ---------------------------------------------------------------------------
// GET /projects/:id/action-items — Project action items (scope: scores:read)
// GET /projects/:id/action-plan — Legacy alias, use /action-items
// ---------------------------------------------------------------------------

async function getProjectActionItemsResponse(c: any, projectId: string) {
  const db = c.get("db");
  const pq = projectQueries(db);
  const aq = actionItemQueries(db);

  const project = await pq.getById(projectId);
  if (!project) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const items = await aq.listByProject(projectId);

  return c.json({
    data: {
      projectId,
      actionItems: items.map((item) => ({
        id: item.id,
        issueCode: item.issueCode,
        status: item.status,
        severity: item.severity,
        category: item.category,
        scoreImpact: item.scoreImpact,
        title: item.title,
        description: item.description,
        assigneeId: item.assigneeId,
        dueAt: item.dueAt,
        verifiedAt: item.verifiedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: items.length,
    },
  });
}

v1Routes.get("/projects/:id/action-items", async (c) => {
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

  return getProjectActionItemsResponse(c, projectId);
});

v1Routes.get("/projects/:id/action-plan", async (c) => {
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

  c.header("Deprecation", "true");
  c.header(
    "Link",
    `</api/v1/projects/${projectId}/action-items>; rel="successor-version"`,
  );
  return getProjectActionItemsResponse(c, projectId);
});
