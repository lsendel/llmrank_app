import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  pageQueries,
  scoreQueries,
  projectQueries,
  crawlQueries,
  enrichmentQueries,
} from "@llm-boost/db";
import { ERROR_CODES } from "@llm-boost/shared";

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export const pageRoutes = new Hono<AppEnv>();

// All page routes require authentication
pageRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /:id — Page detail with scores and issues
// ---------------------------------------------------------------------------

pageRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const pageId = c.req.param("id");

  const page = await pageQueries(db).getById(pageId);
  if (!page) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Verify ownership: page -> project -> user
  const project = await projectQueries(db).getById(page.projectId);
  if (!project || project.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Fetch scores and issues in parallel
  const [score, issues] = await Promise.all([
    scoreQueries(db).getByPage(pageId),
    scoreQueries(db).getIssuesByPage(pageId),
  ]);

  return c.json({
    data: {
      ...page,
      score: score ?? null,
      issues,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /job/:jobId — List all pages for a crawl job
// ---------------------------------------------------------------------------

pageRoutes.get("/job/:jobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  const crawl = await crawlQueries(db).getById(jobId);
  if (!crawl) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  // 3 parallel queries instead of 2N (eliminates N+1)
  const scoresWithPages = await scoreQueries(db).listByJobWithPages(jobId);

  const pagesWithScores = scoresWithPages.map((s) => ({
    ...(s.page ?? {}),
    id: s.page?.id ?? s.pageId,
    overall_score: s.overallScore,
    technical_score: s.technicalScore ?? null,
    content_score: s.contentScore ?? null,
    ai_readiness_score: s.aiReadinessScore ?? null,
    letter_grade: letterGrade(s.overallScore),
    issue_count: s.issueCount,
  }));

  return c.json({
    data: pagesWithScores,
    pagination: {
      page: 1,
      limit: 100,
      total: pagesWithScores.length,
      totalPages: 1,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /issues/job/:jobId — List all issues for a crawl job
// ---------------------------------------------------------------------------

pageRoutes.get("/issues/job/:jobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  const crawl = await crawlQueries(db).getById(jobId);
  if (!crawl) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const project = await projectQueries(db).getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const allIssues = await scoreQueries(db).getIssuesByJob(jobId);
  return c.json({
    data: allIssues,
    pagination: { page: 1, limit: 500, total: allIssues.length, totalPages: 1 },
  });
});

// ---------------------------------------------------------------------------
// GET /:id/enrichments — Get integration enrichment data for a page
// ---------------------------------------------------------------------------

pageRoutes.get("/:id/enrichments", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("id");

  const enrichments = await enrichmentQueries(db).listByPage(pageId);
  return c.json({ data: enrichments });
});
