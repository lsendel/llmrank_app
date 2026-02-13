import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  projectQueries,
  crawlQueries,
  userQueries,
  scoreQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /stats — aggregate dashboard statistics
// ---------------------------------------------------------------------------

dashboardRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  const projects = await projectQueries(db).listByUser(userId);

  const limits = PLAN_LIMITS[user?.plan ?? "free"];
  const creditsTotal =
    limits.crawlsPerMonth === Infinity ? 999 : limits.crawlsPerMonth;

  // Count total crawls and collect completed job IDs for scoring
  let totalCrawls = 0;
  const completedJobIds: string[] = [];

  for (const project of projects) {
    const crawls = await crawlQueries(db).listByProject(project.id);
    totalCrawls += crawls.length;
    for (const crawl of crawls) {
      if (crawl.status === "complete") {
        completedJobIds.push(crawl.id);
      }
    }
  }

  // Calculate average score across all completed crawls
  let avgScore = 0;
  if (completedJobIds.length > 0) {
    const allScores: number[] = [];
    for (const jobId of completedJobIds) {
      const pageScoreRows = await scoreQueries(db).listByJob(jobId);
      for (const row of pageScoreRows) {
        allScores.push(row.overallScore);
      }
    }
    if (allScores.length > 0) {
      avgScore = Math.round(
        allScores.reduce((a, b) => a + b, 0) / allScores.length,
      );
    }
  }

  return c.json({
    data: {
      totalProjects: projects.length,
      totalCrawls,
      avgScore,
      creditsRemaining: user?.crawlCreditsRemaining ?? 0,
      creditsTotal,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /activity — recent crawl jobs across all user projects
// ---------------------------------------------------------------------------

dashboardRoutes.get("/activity", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const projects = await projectQueries(db).listByUser(userId);

  const allCrawls: Array<Record<string, unknown>> = [];
  for (const project of projects.slice(0, 10)) {
    const crawls = await crawlQueries(db).listByProject(project.id);
    for (const crawl of crawls.slice(0, 5)) {
      // Enrich completed crawls with aggregated scores
      let overallScore: number | null = null;
      let letterGrade: string | null = null;

      if (crawl.status === "complete") {
        const pageScoreRows = await scoreQueries(db).listByJob(crawl.id);
        if (pageScoreRows.length > 0) {
          const scores = pageScoreRows.map((s) => s.overallScore);
          overallScore = Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length,
          );
          if (overallScore >= 90) letterGrade = "A";
          else if (overallScore >= 80) letterGrade = "B";
          else if (overallScore >= 70) letterGrade = "C";
          else if (overallScore >= 60) letterGrade = "D";
          else letterGrade = "F";
        }
      }

      allCrawls.push({
        ...crawl,
        projectName: project.name,
        projectId: project.id,
        overallScore,
        letterGrade,
      });
    }
  }

  allCrawls.sort((a, b) => {
    const aTime = new Date(a.createdAt as string).getTime();
    const bTime = new Date(b.createdAt as string).getTime();
    return bTime - aTime;
  });

  return c.json({ data: allCrawls.slice(0, 5) });
});
