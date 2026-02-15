import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  PageRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface InsightsServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  scores: ScoreRepository;
  pages: PageRepository;
}

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function createInsightsService(deps: InsightsServiceDeps) {
  async function assertAccess(userId: string, crawlId: string) {
    const crawl = await deps.crawls.getById(crawlId);
    if (!crawl) {
      throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
    }
    const project = await deps.projects.getById(crawl.projectId);
    if (!project || project.userId !== userId) {
      throw new ServiceError("NOT_FOUND", 404, "Not found");
    }
    return { crawl, project };
  }

  return {
    async getInsights(userId: string, crawlId: string) {
      const { crawl } = await assertAccess(userId, crawlId);

      const [allScores, allIssues, allPages] = await Promise.all([
        deps.scores.listByJob(crawlId),
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      // Issue distribution
      const sevMap = new Map<string, number>();
      const catMap = new Map<string, number>();
      for (const issue of allIssues) {
        sevMap.set(issue.severity, (sevMap.get(issue.severity) ?? 0) + 1);
        catMap.set(issue.category, (catMap.get(issue.category) ?? 0) + 1);
      }

      // Grade distribution
      const gradeMap = new Map<string, number>();
      for (const score of allScores) {
        const g = letterGrade(score.overallScore);
        gradeMap.set(g, (gradeMap.get(g) ?? 0) + 1);
      }

      // Score radar (averages)
      const avg = (arr: (number | null)[]) => {
        const nums = arr.filter((n): n is number => n != null);
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      };

      // Content ratio
      const wordCounts = allPages.map((p) => p.wordCount ?? 0);
      const avgWordCount = wordCounts.length
        ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
        : 0;
      const GOOD_WORD_COUNT = 300;

      return {
        issueDistribution: {
          bySeverity: Array.from(sevMap, ([severity, count]) => ({
            severity,
            count,
          })),
          byCategory: Array.from(catMap, ([category, count]) => ({
            category,
            count,
          })),
          total: allIssues.length,
        },
        gradeDistribution: ["A", "B", "C", "D", "F"].map((grade) => ({
          grade,
          count: gradeMap.get(grade) ?? 0,
          percentage: allScores.length
            ? Math.round(((gradeMap.get(grade) ?? 0) / allScores.length) * 100)
            : 0,
        })),
        scoreRadar: {
          technical:
            Math.round(avg(allScores.map((s) => s.technicalScore)) * 10) / 10,
          content:
            Math.round(avg(allScores.map((s) => s.contentScore)) * 10) / 10,
          aiReadiness:
            Math.round(avg(allScores.map((s) => s.aiReadinessScore)) * 10) / 10,
          performance:
            Math.round(
              avg(
                allScores.map((s) =>
                  s.lighthousePerf != null ? s.lighthousePerf * 100 : null,
                ),
              ) * 10,
            ) / 10,
        },
        contentRatio: {
          avgWordCount: Math.round(avgWordCount * 10) / 10,
          avgHtmlToTextRatio: 0,
          pagesAboveThreshold: wordCounts.filter((w) => w >= GOOD_WORD_COUNT)
            .length,
          totalPages: allPages.length,
        },
        crawlProgress: {
          found: crawl.pagesFound,
          crawled: crawl.pagesCrawled,
          scored: crawl.pagesScored,
          errored: crawl.errorMessage ? 1 : 0,
          status: crawl.status,
        },
      };
    },

    async getIssueHeatmap(userId: string, crawlId: string) {
      await assertAccess(userId, crawlId);

      const [allIssues, allPages] = await Promise.all([
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      const categories = [...new Set(allIssues.map((i) => i.category))].sort();

      // Group issues by page, take worst severity per category
      const pageIssueMap = new Map<string, Map<string, string>>();
      for (const issue of allIssues) {
        if (!pageIssueMap.has(issue.pageId)) {
          pageIssueMap.set(issue.pageId, new Map());
        }
        const catMap = pageIssueMap.get(issue.pageId)!;
        const current = catMap.get(issue.category);
        if (!current || severityRank(issue.severity) > severityRank(current)) {
          catMap.set(issue.category, issue.severity);
        }
      }

      // Sort pages by issue count desc, limit to 50
      const pageIssueCounts = new Map<string, number>();
      for (const issue of allIssues) {
        pageIssueCounts.set(
          issue.pageId,
          (pageIssueCounts.get(issue.pageId) ?? 0) + 1,
        );
      }

      const sortedPages = allPages
        .sort(
          (a, b) =>
            (pageIssueCounts.get(b.id) ?? 0) - (pageIssueCounts.get(a.id) ?? 0),
        )
        .slice(0, 50);

      return {
        categories,
        pages: sortedPages.map((p) => {
          const catIssues = pageIssueMap.get(p.id) ?? new Map();
          const issues: Record<string, string> = {};
          for (const cat of categories) {
            issues[cat] = catIssues.get(cat) ?? "pass";
          }
          return { url: p.url, pageId: p.id, issues };
        }),
      };
    },
  };
}

function severityRank(sev: string): number {
  if (sev === "critical") return 3;
  if (sev === "warning") return 2;
  if (sev === "info") return 1;
  return 0;
}
