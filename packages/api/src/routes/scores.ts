import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  scoreQueries,
  crawlQueries,
  projectQueries,
  pageQueries,
} from "@llm-boost/db";

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export const scoreRoutes = new Hono<AppEnv>();

scoreRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /job/:jobId/pages — List all page scores for a crawl job
// ---------------------------------------------------------------------------

scoreRoutes.get("/job/:jobId/pages", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  const crawl = await crawlQueries(db).getById(jobId);
  if (!crawl) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl job not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const scoresWithPages = await scoreQueries(db).listByJobWithPages(jobId);

  const data = scoresWithPages.map((s) => ({
    id: s.id,
    pageId: s.pageId,
    url: s.page?.url ?? "",
    title: s.page?.title ?? null,
    statusCode: s.page?.statusCode ?? null,
    wordCount: s.page?.wordCount ?? null,
    overallScore: s.overallScore,
    technicalScore: s.technicalScore,
    contentScore: s.contentScore,
    aiReadinessScore: s.aiReadinessScore,
    lighthousePerf: s.lighthousePerf,
    lighthouseSeo: s.lighthouseSeo,
    letterGrade: letterGrade(s.overallScore),
    issueCount: s.issueCount,
    detail: s.detail,
  }));

  return c.json({ data });
});

// ---------------------------------------------------------------------------
// GET /page/:pageId — Single page detail with scores and issues
// ---------------------------------------------------------------------------

scoreRoutes.get("/page/:pageId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const pageId = c.req.param("pageId");

  const page = await pageQueries(db).getById(pageId);
  if (!page) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Page not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(page.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const { score, issues } = await scoreQueries(db).getByPageWithIssues(pageId);

  const detail = (score?.detail ?? {}) as Record<string, unknown>;

  return c.json({
    data: {
      id: page.id,
      jobId: page.jobId,
      url: page.url,
      canonicalUrl: page.canonicalUrl,
      statusCode: page.statusCode,
      title: page.title,
      metaDesc: page.metaDesc,
      wordCount: page.wordCount,
      contentHash: page.contentHash,
      crawledAt: page.crawledAt,
      score: score
        ? {
            overallScore: score.overallScore,
            technicalScore: score.technicalScore,
            contentScore: score.contentScore,
            aiReadinessScore: score.aiReadinessScore,
            lighthousePerf: score.lighthousePerf,
            lighthouseSeo: score.lighthouseSeo,
            letterGrade: letterGrade(score.overallScore),
            detail,
          }
        : null,
      issues: issues.map((issue) => ({
        id: issue.id,
        code: issue.code,
        category: issue.category,
        severity: issue.severity,
        message: issue.message,
        recommendation: issue.recommendation,
        data: issue.data,
      })),
    },
  });
});
