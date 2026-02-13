import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { signPayload } from "../middleware/hmac";
import {
  projectQueries,
  crawlQueries,
  userQueries,
  scoreQueries,
} from "@llm-boost/db";
import {
  ERROR_CODES,
  PLAN_LIMITS,
  getQuickWins,
  type CrawlJobPayload,
} from "@llm-boost/shared";

export const crawlRoutes = new Hono<AppEnv>();

// All crawl routes require authentication
crawlRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST / — Start a new crawl
// ---------------------------------------------------------------------------

crawlRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json();
  const { projectId } = body as { projectId: string };

  if (!projectId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId is required" } },
      422,
    );
  }

  // Verify project ownership
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Check user and plan limits
  const user = await userQueries(db).getById(userId);
  if (!user) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      err.status,
    );
  }

  const limits = PLAN_LIMITS[user.plan];

  // Check crawl credits
  if (user.crawlCreditsRemaining <= 0) {
    const err = ERROR_CODES.CRAWL_LIMIT_REACHED;
    return c.json(
      { error: { code: "CRAWL_LIMIT_REACHED", message: err.message } },
      err.status,
    );
  }

  // Check no crawl in progress for this project
  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (
    latestCrawl &&
    ["pending", "queued", "crawling", "scoring"].includes(latestCrawl.status)
  ) {
    const err = ERROR_CODES.CRAWL_IN_PROGRESS;
    return c.json(
      { error: { code: "CRAWL_IN_PROGRESS", message: err.message } },
      err.status,
    );
  }

  // Decrement credits
  const decremented = await userQueries(db).decrementCrawlCredits(userId);
  if (!decremented) {
    const err = ERROR_CODES.CRAWL_LIMIT_REACHED;
    return c.json(
      { error: { code: "CRAWL_LIMIT_REACHED", message: err.message } },
      err.status,
    );
  }

  // Build crawl config from plan limits and project settings
  const settings = (project.settings as Record<string, unknown>) ?? {};
  const maxPages = Math.min(
    (settings.maxPages as number) || limits.pagesPerCrawl,
    limits.pagesPerCrawl,
  );
  const maxDepth = Math.min(
    (settings.maxDepth as number) || limits.maxCrawlDepth,
    limits.maxCrawlDepth,
  );

  const crawlConfig = {
    seed_urls: [project.domain],
    max_pages: maxPages,
    max_depth: maxDepth,
    respect_robots: true,
    run_lighthouse: true,
    extract_schema: true,
    extract_links: true,
    check_llms_txt: true,
    user_agent: "AISEOBot/1.0",
    rate_limit_ms: 1000,
    timeout_s: 30,
  };

  // Create crawl_job record
  const crawlJob = await crawlQueries(db).create({
    projectId,
    config: crawlConfig,
  });

  // If no crawler URL configured, mark job as unavailable
  if (!c.env.CRAWLER_URL) {
    await crawlQueries(db).updateStatus(crawlJob.id, {
      status: "failed",
      errorMessage: "Crawler service is not yet available. Coming soon!",
    });
    return c.json(
      {
        data: {
          ...crawlJob,
          status: "failed",
          errorMessage: "Crawler service is not yet available.",
        },
      },
      201,
    );
  }

  // Build callback URL
  const callbackUrl = new URL("/ingest/batch", c.req.url).toString();

  const payload: CrawlJobPayload = {
    job_id: crawlJob.id,
    callback_url: callbackUrl,
    config: crawlConfig,
  };

  // Dispatch to Hetzner crawler with HMAC signature
  const payloadJson = JSON.stringify(payload);
  const { signature, timestamp } = await signPayload(
    c.env.SHARED_SECRET,
    payloadJson,
  );

  try {
    const crawlerResponse = await fetch(`${c.env.CRAWLER_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Timestamp": timestamp,
      },
      body: payloadJson,
    });

    if (!crawlerResponse.ok) {
      // Mark job as failed if dispatch fails
      await crawlQueries(db).updateStatus(crawlJob.id, {
        status: "failed",
        errorMessage: `Crawler dispatch failed: ${crawlerResponse.status} ${crawlerResponse.statusText}`,
      });
      return c.json(
        {
          error: {
            code: "CRAWLER_ERROR",
            message: "Failed to dispatch crawl job to crawler",
          },
        },
        502,
      );
    }

    // Mark job as queued
    await crawlQueries(db).updateStatus(crawlJob.id, {
      status: "queued",
      startedAt: new Date(),
    });
  } catch (error) {
    await crawlQueries(db).updateStatus(crawlJob.id, {
      status: "failed",
      errorMessage: `Crawler dispatch error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return c.json(
      {
        error: {
          code: "CRAWLER_ERROR",
          message: "Failed to connect to crawler service",
        },
      },
      502,
    );
  }

  return c.json({ data: crawlJob }, 201);
});

// ---------------------------------------------------------------------------
// GET /:id — Get crawl status and progress
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const crawlJob = await crawlQueries(db).getById(crawlId);
  if (!crawlJob) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Verify the user owns the project this crawl belongs to
  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project || project.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Aggregate scores from page_scores when crawl is complete
  let overallScore: number | null = null;
  let letterGrade: string | null = null;
  let scores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  } | null = null;

  if (crawlJob.status === "complete") {
    const pageScoreRows = await scoreQueries(db).listByJob(crawlId);
    if (pageScoreRows.length > 0) {
      const avg = (vals: (number | null)[]) => {
        const nums = vals.filter((v): v is number => v !== null);
        return nums.length > 0
          ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
          : 0;
      };

      overallScore = avg(pageScoreRows.map((s) => s.overallScore));
      const technical = avg(pageScoreRows.map((s) => s.technicalScore));
      const content = avg(pageScoreRows.map((s) => s.contentScore));
      const aiReadiness = avg(pageScoreRows.map((s) => s.aiReadinessScore));

      // Performance from detail.performanceScore or lighthouse data
      const perfScores = pageScoreRows.map((s) => {
        const detail = s.detail as Record<string, unknown> | null;
        return (detail?.performanceScore as number) ?? null;
      });
      const performance = avg(perfScores);

      scores = { technical, content, aiReadiness, performance };

      // Derive letter grade from overall score
      if (overallScore >= 90) letterGrade = "A";
      else if (overallScore >= 80) letterGrade = "B";
      else if (overallScore >= 70) letterGrade = "C";
      else if (overallScore >= 60) letterGrade = "D";
      else letterGrade = "F";
    }
  }

  return c.json({
    data: {
      ...crawlJob,
      projectName: project.name,
      overallScore,
      letterGrade,
      scores,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /project/:projectId — List crawls for a project
// ---------------------------------------------------------------------------

crawlRoutes.get("/project/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const crawls = await crawlQueries(db).listByProject(projectId);
  return c.json({
    data: crawls,
    pagination: { page: 1, limit: 50, total: crawls.length, totalPages: 1 },
  });
});

// ---------------------------------------------------------------------------
// GET /:id/quick-wins — Top 5 highest-impact, easiest-to-fix issues
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/quick-wins", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const crawlJob = await crawlQueries(db).getById(crawlId);
  if (!crawlJob) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const issues = await scoreQueries(db).getIssuesByJob(crawlId);
  const wins = getQuickWins(issues);

  return c.json({ data: wins });
});

// ---------------------------------------------------------------------------
// GET /:id/platform-readiness — Pass/fail per AI platform
// ---------------------------------------------------------------------------

crawlRoutes.get("/:id/platform-readiness", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const crawlJob = await crawlQueries(db).getById(crawlId);
  if (!crawlJob) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const issues = await scoreQueries(db).getIssuesByJob(crawlId);
  const issueCodes = new Set(issues.map((i) => i.code));

  // Import dynamically to keep the route file lean
  const { PLATFORM_REQUIREMENTS } = await import("@llm-boost/shared");

  const matrix = Object.entries(PLATFORM_REQUIREMENTS).map(
    ([platform, checks]) => ({
      platform,
      checks: checks.map((check) => ({
        factor: check.factor,
        label: check.label,
        importance: check.importance,
        pass: !issueCodes.has(check.issueCode),
      })),
    }),
  );

  return c.json({ data: matrix });
});

// ---------------------------------------------------------------------------
// POST /:id/share — Enable sharing, generate token
// ---------------------------------------------------------------------------

crawlRoutes.post("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const crawlJob = await crawlQueries(db).getById(crawlId);
  if (!crawlJob) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  // Re-use existing token if already shared, otherwise generate
  let updated;
  if (crawlJob.shareToken && crawlJob.shareEnabled) {
    updated = crawlJob;
  } else if (crawlJob.shareToken) {
    // Re-enable existing token
    updated = await crawlQueries(db).generateShareToken(crawlId);
  } else {
    updated = await crawlQueries(db).generateShareToken(crawlId);
  }

  const shareUrl = `/report/${updated.shareToken}`;

  return c.json({
    data: { shareToken: updated.shareToken, shareUrl },
  });
});

// ---------------------------------------------------------------------------
// DELETE /:id/share — Disable sharing
// ---------------------------------------------------------------------------

crawlRoutes.delete("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");

  const crawlJob = await crawlQueries(db).getById(crawlId);
  if (!crawlJob) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  await crawlQueries(db).disableSharing(crawlId);

  return c.json({ data: { disabled: true } });
});
