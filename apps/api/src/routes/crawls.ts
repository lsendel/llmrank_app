import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { handleServiceError } from "../services/errors";
import { toCrawlResponse, toCrawlListResponse } from "../dto/crawl.dto";
import { rateLimit } from "../middleware/rate-limit";
import { pageQueries, scoreQueries, userQueries } from "@llm-boost/db";

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

    const { crawlService } = c.get("container");

    try {
      const crawlJob = await crawlService.requestCrawl({
        userId,
        projectId,
        requestUrl: c.req.url,
        env: {
          crawlerUrl: c.env.CRAWLER_URL,
          sharedSecret: c.env.SHARED_SECRET,
          kv: c.env.KV,
        },
      });
      return c.json({ data: toCrawlResponse(crawlJob) }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — Get crawl status and progress
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id", withOwnership("crawl"), async (c) => {
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const { crawlService } = c.get("container");

  try {
    const data = await crawlService.getCrawl(userId, crawlId);
    if ("status" in data && data.status === "complete") {
      c.header("Cache-Control", "public, max-age=86400, immutable");
    } else {
      c.header("Cache-Control", "private, max-age=10");
    }
    return c.json({ data: toCrawlResponse(data) });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /project/:projectId — List crawls for a project
// ---------------------------------------------------------------------------

crawlRoutes.get("/project/:projectId", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const { crawlService } = c.get("container");

  try {
    const crawls = await crawlService.listProjectCrawls(userId, projectId);
    return c.json({
      data: toCrawlListResponse(crawls),
      pagination: { page: 1, limit: 50, total: crawls.length, totalPages: 1 },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/quick-wins — Top 5 highest-impact, easiest-to-fix issues
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/quick-wins", withOwnership("crawl"), async (c) => {
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const { crawlService } = c.get("container");

  try {
    const wins = await crawlService.getQuickWins(userId, crawlId);
    return c.json({ data: wins });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/export — Export crawl data as CSV or JSON (Starter+ only)
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/export", withOwnership("crawl"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const format = c.req.query("format") ?? "json";

  if (format !== "csv" && format !== "json") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "format must be csv or json",
        },
      },
      422,
    );
  }

  // Plan gate: Starter+ only
  const user = await userQueries(db).getById(userId);
  if (!user || user.plan === "free") {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message:
            "Data export is available on Starter plans and above. Upgrade to export your crawl data.",
        },
      },
      403,
    );
  }

  // Ownership already verified by withOwnership("crawl") middleware

  // Fetch pages and scores
  let crawledPages, scores, allIssues;
  try {
    [crawledPages, scores, allIssues] = await Promise.all([
      pageQueries(db).listByJob(crawlId),
      scoreQueries(db).listByJob(crawlId),
      scoreQueries(db).getIssuesByJob(crawlId),
    ]);
  } catch (err) {
    console.error(`[export] Failed to fetch data for crawl ${crawlId}:`, err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch crawl data",
        },
      },
      500,
    );
  }

  // Build score and issue lookups by pageId
  const scoreMap = new Map(scores.map((s) => [s.pageId, s]));
  const issueMap = new Map<string, typeof allIssues>();
  for (const issue of allIssues) {
    const existing = issueMap.get(issue.pageId) ?? [];
    existing.push(issue);
    issueMap.set(issue.pageId, existing);
  }

  const rows = crawledPages.map((page) => {
    const score = scoreMap.get(page.id);
    const pageIssues = issueMap.get(page.id) ?? [];
    return {
      url: page.url,
      title: page.title,
      overallScore: score?.overallScore ?? null,
      technicalScore: score?.technicalScore ?? null,
      contentScore: score?.contentScore ?? null,
      aiReadinessScore: score?.aiReadinessScore ?? null,
      grade:
        score?.overallScore != null
          ? score.overallScore >= 90
            ? "A"
            : score.overallScore >= 80
              ? "B"
              : score.overallScore >= 70
                ? "C"
                : score.overallScore >= 60
                  ? "D"
                  : "F"
          : null,
      issueCodes: pageIssues.map((i) => i.code).join("; "),
      recommendations: pageIssues
        .filter((i) => i.recommendation)
        .map((i) => i.recommendation)
        .join("; "),
    };
  });

  if (format === "json") {
    return c.json({ data: rows });
  }

  // CSV format
  const headers = [
    "url",
    "title",
    "overallScore",
    "technicalScore",
    "contentScore",
    "aiReadinessScore",
    "grade",
    "issueCodes",
    "recommendations",
  ];
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h as keyof typeof row];
          if (val == null) return "";
          const str = String(val);
          // Escape CSV fields with commas, quotes, or newlines
          return str.includes(",") ||
            str.includes('"') ||
            str.includes("\n") ||
            str.includes("\r")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(","),
    ),
  ];

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="crawl-${crawlId}.csv"`,
  );
  return c.text(csvRows.join("\n"));
});

// ---------------------------------------------------------------------------
// GET /:id/platform-readiness — Pass/fail per AI platform
// ---------------------------------------------------------------------------

crawlRoutes.get(
  "/:id/platform-readiness",
  withOwnership("crawl"),
  async (c) => {
    const userId = c.get("userId");
    const crawlId = c.req.param("id");
    const { crawlService } = c.get("container");

    try {
      const data = await crawlService.getPlatformReadiness(userId, crawlId);
      return c.json({ data });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:id/share — Enable sharing, generate token
// ---------------------------------------------------------------------------

crawlRoutes.post("/:id/share", withOwnership("crawl"), async (c) => {
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const { crawlService } = c.get("container");

  try {
    const data = await crawlService.enableSharing(userId, crawlId, {
      level: body.level,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/share — Disable sharing
// ---------------------------------------------------------------------------

crawlRoutes.delete("/:id/share", withOwnership("crawl"), async (c) => {
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const { crawlService } = c.get("container");

  try {
    const data = await crawlService.disableSharing(userId, crawlId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id/share — Update share settings (level, expiry)
// ---------------------------------------------------------------------------

crawlRoutes.patch("/:id/share", withOwnership("crawl"), async (c) => {
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const body = await c.req.json();

  const { crawlService } = c.get("container");

  try {
    const data = await crawlService.updateShareSettings(userId, crawlId, {
      level: body.level,
      expiresAt:
        body.expiresAt === null
          ? null
          : body.expiresAt
            ? new Date(body.expiresAt)
            : undefined,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
