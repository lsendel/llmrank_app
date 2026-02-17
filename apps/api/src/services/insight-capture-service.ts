import { letterGrade } from "@llm-boost/shared";
import type {
  CrawlInsightRepository,
  PageInsightRepository,
} from "../repositories";

interface CaptureArgs {
  crawlId: string;
  projectId: string;
  scores: Array<{
    id: string;
    pageId: string;
    overallScore: number;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    lighthousePerf: number | null;
    platformScores?: Record<string, { score?: number; tips?: string[] }> | null;
  }>;
  issues: Array<{
    pageId: string;
    code: string;
    severity: "critical" | "warning" | "info";
    category: string;
  }>;
  pages: Array<{
    id: string;
    url: string;
    title: string | null;
    wordCount: number | null;
  }>;
}

const MAX_PAGE_INSIGHTS = 100;

export interface InsightCaptureDeps {
  crawlInsights: CrawlInsightRepository;
  pageInsights: PageInsightRepository;
}

export function createInsightCaptureService(deps: InsightCaptureDeps) {
  return {
    async capture(args: CaptureArgs) {
      const crawlRows = buildCrawlInsightRows(args);
      await deps.crawlInsights.replaceForCrawl(args.crawlId, crawlRows as any);

      const pageRows = buildPageInsightRows(args).slice(0, MAX_PAGE_INSIGHTS);
      await deps.pageInsights.replaceForCrawl(args.crawlId, pageRows as any);
    },
  };
}

function average(values: Array<number | null | undefined>): number {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function buildCrawlInsightRows({
  crawlId,
  projectId,
  scores,
  issues,
  pages,
}: CaptureArgs) {
  const gradeCounts = new Map<string, number>();
  const severityCounts = new Map<string, number>();
  const issueCounts = new Map<
    string,
    {
      count: number;
      severity: "critical" | "warning" | "info";
      category: string;
    }
  >();

  for (const score of scores) {
    const grade = letterGrade(score.overallScore);
    gradeCounts.set(grade, (gradeCounts.get(grade) ?? 0) + 1);
  }

  for (const issue of issues) {
    severityCounts.set(
      issue.severity,
      (severityCounts.get(issue.severity) ?? 0) + 1,
    );
    const entry = issueCounts.get(issue.code) ?? {
      count: 0,
      severity: issue.severity,
      category: issue.category,
    };
    entry.count += 1;
    if (severityRank(issue.severity) > severityRank(entry.severity)) {
      entry.severity = issue.severity;
    }
    issueCounts.set(issue.code, entry);
  }

  const scoreSummary = {
    averages: {
      overall: round(average(scores.map((s) => s.overallScore))),
      technical: round(average(scores.map((s) => s.technicalScore ?? null))),
      content: round(average(scores.map((s) => s.contentScore ?? null))),
      aiReadiness: round(
        average(scores.map((s) => s.aiReadinessScore ?? null)),
      ),
      performance: round(
        average(
          scores.map((s) =>
            typeof s.lighthousePerf === "number"
              ? s.lighthousePerf * 100
              : null,
          ),
        ),
      ),
    },
    gradeDistribution: ["A", "B", "C", "D", "F"].map((grade) => ({
      grade,
      count: gradeCounts.get(grade) ?? 0,
    })),
    sampleSize: scores.length,
  };

  const topIssues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([code, value]) => ({ code, ...value }));

  const wordCounts = pages.map((p) => p.wordCount ?? 0);
  const contentInsight = {
    avgWordCount: round(average(wordCounts)),
    pagesBelow300: wordCounts.filter((count) => count < 300).length,
    totalPages: pages.length,
  };

  const platformTotals = new Map<
    string,
    { score: number; count: number; tips: Set<string> }
  >();
  for (const score of scores) {
    if (!score.platformScores) continue;
    for (const [platform, data] of Object.entries(score.platformScores)) {
      const current = platformTotals.get(platform) ?? {
        score: 0,
        count: 0,
        tips: new Set<string>(),
      };
      if (typeof data?.score === "number") {
        current.score += data.score;
        current.count += 1;
      }
      if (Array.isArray(data?.tips)) {
        data.tips.forEach((tip) => current.tips.add(tip));
      }
      platformTotals.set(platform, current);
    }
  }
  const platformReadiness = Array.from(platformTotals.entries()).map(
    ([platform, data]) => ({
      platform,
      avgScore: data.count ? round(data.score / data.count) : 0,
      tips: Array.from(data.tips).slice(0, 5),
    }),
  );

  return [
    {
      crawlId,
      projectId,
      category: "summary" as const,
      type: "score_summary",
      severity: "info" as const,
      headline: "Score overview",
      summary: `Average overall score ${scoreSummary.averages.overall}`,
      data: scoreSummary,
    },
    {
      crawlId,
      projectId,
      category: "issue" as const,
      type: "issue_distribution",
      severity: (issues.length ? "warning" : "info") as "warning" | "info",
      headline: "Issue snapshot",
      summary: `${issues.length} issues detected across the crawl`,
      data: {
        totals: Object.fromEntries(severityCounts),
        topIssues,
      },
    },
    {
      crawlId,
      projectId,
      category: "content" as const,
      type: "content_depth",
      severity: (contentInsight.pagesBelow300 > 0 ? "warning" : "info") as
        | "warning"
        | "info",
      headline: "Content depth",
      summary: `${contentInsight.pagesBelow300} pages under 300 words`,
      data: contentInsight,
    },
    {
      crawlId,
      projectId,
      category: "platform" as const,
      type: "platform_readiness",
      severity: (platformReadiness.some((p) => p.avgScore < 70)
        ? "warning"
        : "info") as "warning" | "info",
      headline: "Assistant readiness",
      summary: `Tracked across ${platformReadiness.length} assistants`,
      data: { platforms: platformReadiness },
    },
  ];
}

function buildPageInsightRows({
  crawlId,
  projectId,
  scores,
  issues,
  pages,
}: CaptureArgs) {
  const issuesByPage = new Map<string, typeof issues>();
  for (const issue of issues) {
    if (!issuesByPage.has(issue.pageId)) {
      issuesByPage.set(issue.pageId, []);
    }
    issuesByPage.get(issue.pageId)!.push(issue);
  }

  const scoreByPage = new Map<string, { overallScore: number }>();
  for (const score of scores) {
    scoreByPage.set(score.pageId, { overallScore: score.overallScore });
  }

  const pagesWithIssues = pages
    .filter((page) => (issuesByPage.get(page.id) ?? []).length > 0)
    .map((page) => ({
      page,
      issueCount: (issuesByPage.get(page.id) ?? []).length,
    }))
    .sort((a, b) => b.issueCount - a.issueCount);

  return pagesWithIssues.map(({ page, issueCount }) => {
    const pageIssues = (issuesByPage.get(page.id) ?? []).sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    );
    const topIssues = pageIssues.slice(0, 3).map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      category: issue.category,
    }));
    const grade = scoreByPage.has(page.id)
      ? letterGrade(scoreByPage.get(page.id)!.overallScore)
      : null;

    return {
      crawlId,
      projectId,
      pageId: page.id,
      url: page.url,
      category: "issue" as const,
      type: "page_hotspot",
      severity: topIssues[0]?.severity ?? "info",
      headline: page.title ?? page.url,
      summary: `${issueCount} issues detected on this page`,
      data: {
        issueCount,
        grade,
        issues: topIssues,
      },
    };
  });
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function severityRank(severity: string | undefined) {
  if (!severity) return 0;
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  if (severity === "info") return 1;
  return 0;
}
