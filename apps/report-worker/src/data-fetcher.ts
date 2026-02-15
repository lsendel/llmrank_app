import {
  type Database,
  projects,
  crawlJobs,
  pages,
  pageScores,
  issues,
  visibilityChecks,
  pageEnrichments,
  eq,
  and,
  sql,
} from "@llm-boost/db";
import type { RawDbResults } from "@llm-boost/reports";
import type { GenerateReportJob } from "@llm-boost/reports";

export async function fetchReportData(
  db: Database,
  job: GenerateReportJob,
): Promise<RawDbResults> {
  // Fetch project
  const [project] = await db
    .select({
      name: projects.name,
      domain: projects.domain,
      branding: projects.branding,
    })
    .from(projects)
    .where(eq(projects.id, job.projectId));

  if (!project) throw new Error(`Project ${job.projectId} not found`);

  // Fetch crawl
  const [crawl] = await db
    .select({
      id: crawlJobs.id,
      completedAt: crawlJobs.completedAt,
      pagesFound: crawlJobs.pagesFound,
      pagesCrawled: crawlJobs.pagesCrawled,
      pagesScored: crawlJobs.pagesScored,
      summary: crawlJobs.summary,
    })
    .from(crawlJobs)
    .where(eq(crawlJobs.id, job.crawlJobId));

  if (!crawl) throw new Error(`Crawl job ${job.crawlJobId} not found`);

  // Fetch page scores with page info
  const pageScoreRows = await db
    .select({
      url: pages.url,
      title: pages.title,
      overallScore: pageScores.overallScore,
      technicalScore: pageScores.technicalScore,
      contentScore: pageScores.contentScore,
      aiReadinessScore: pageScores.aiReadinessScore,
      lighthousePerf: pageScores.lighthousePerf,
      lighthouseSeo: pageScores.lighthouseSeo,
      detail: pageScores.detail,
    })
    .from(pageScores)
    .innerJoin(pages, eq(pages.id, pageScores.pageId))
    .where(eq(pageScores.jobId, job.crawlJobId));

  // Fetch issues
  const issueRows = await db
    .select({
      code: issues.code,
      category: issues.category,
      severity: issues.severity,
      message: issues.message,
      recommendation: issues.recommendation,
    })
    .from(issues)
    .where(eq(issues.jobId, job.crawlJobId));

  // Fetch history crawls (previous crawls for the same project)
  const historyCrawls = await db
    .select({
      id: crawlJobs.id,
      completedAt: crawlJobs.completedAt,
      pagesScored: crawlJobs.pagesScored,
    })
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.projectId, job.projectId),
        eq(crawlJobs.status, "complete"),
      ),
    )
    .orderBy(crawlJobs.completedAt)
    .limit(20);

  // For each history crawl, compute average scores
  const historyWithScores = await Promise.all(
    historyCrawls.map(async (hc) => {
      const scores = await db
        .select({
          avgOverall: sql<number>`avg(${pageScores.overallScore})`,
          avgTechnical: sql<number>`avg(${pageScores.technicalScore})`,
          avgContent: sql<number>`avg(${pageScores.contentScore})`,
          avgAiReadiness: sql<number>`avg(${pageScores.aiReadinessScore})`,
        })
        .from(pageScores)
        .where(eq(pageScores.jobId, hc.id));

      const s = scores[0];
      return {
        id: hc.id,
        completedAt: hc.completedAt,
        pagesScored: hc.pagesScored,
        avgOverall: Math.round(Number(s?.avgOverall ?? 0)),
        avgTechnical: Math.round(Number(s?.avgTechnical ?? 0)),
        avgContent: Math.round(Number(s?.avgContent ?? 0)),
        avgAiReadiness: Math.round(Number(s?.avgAiReadiness ?? 0)),
        avgPerformance: 0, // Would need lighthouse data join
      };
    }),
  );

  // Fetch visibility checks
  const visChecks = await db
    .select({
      llmProvider: visibilityChecks.llmProvider,
      brandMentioned: visibilityChecks.brandMentioned,
      urlCited: visibilityChecks.urlCited,
      citationPosition: visibilityChecks.citationPosition,
      competitorMentions: visibilityChecks.competitorMentions,
      query: visibilityChecks.query,
    })
    .from(visibilityChecks)
    .where(eq(visibilityChecks.projectId, job.projectId));

  // Fetch page enrichments (GSC, GA4, Clarity data)
  const enrichmentRows = await db
    .select({
      provider: pageEnrichments.provider,
      data: pageEnrichments.data,
    })
    .from(pageEnrichments)
    .where(eq(pageEnrichments.jobId, job.crawlJobId));

  return {
    project: {
      name: project.name,
      domain: project.domain,
      branding: project.branding as Record<string, unknown> | null,
    },
    crawl: {
      id: crawl.id,
      completedAt: crawl.completedAt?.toISOString() ?? null,
      pagesFound: crawl.pagesFound,
      pagesCrawled: crawl.pagesCrawled,
      pagesScored: crawl.pagesScored,
      summary: crawl.summary,
    },
    pageScores: pageScoreRows.map((p) => ({
      ...p,
      detail: p.detail as Record<string, unknown> | null,
    })),
    issues: issueRows.map((i) => ({
      ...i,
      recommendation: i.recommendation ?? "",
    })),
    historyCrawls: historyWithScores,
    visibilityChecks: visChecks.map((v) => ({
      ...v,
      competitorMentions: v.competitorMentions as
        | { domain: string; mentioned: boolean }[]
        | null,
    })),
    enrichments: enrichmentRows.map((e) => ({
      provider: e.provider,
      data: e.data as Record<string, unknown>,
    })),
  };
}
