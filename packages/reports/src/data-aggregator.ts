import type {
  ReportData,
  ReportIssue,
  ReportQuickWin,
  ReportPageScore,
  ReportHistoryPoint,
  ReportVisibility,
  ReportContentHealth,
} from "./types";
import type { ReportConfig } from "@llm-boost/shared";
import { estimateIssueROI } from "./roi";
import { aggregateCompetitors } from "./competitors";
import { aggregateIntegrations, type RawEnrichment } from "./integrations";

// ---------------------------------------------------------------------------
// Input types (raw DB results)
// ---------------------------------------------------------------------------

export interface RawProject {
  name: string;
  domain: string;
  branding?: Record<string, unknown> | null;
}

export interface RawCrawl {
  id: string;
  completedAt: string | Date | null;
  pagesFound: number | null;
  pagesCrawled: number | null;
  pagesScored: number | null;
  summary: string | null;
}

export interface RawPageScore {
  url: string;
  title: string | null;
  overallScore: number;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  detail: Record<string, unknown> | null;
  issueCount?: number;
}

export interface RawIssue {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string | null;
}

export interface RawVisibilityCheck {
  llmProvider: string;
  brandMentioned: boolean | null;
  urlCited: boolean | null;
  citationPosition: number | null;
  competitorMentions: { domain: string; mentioned: boolean }[] | null;
  query: string;
}

export interface AggregateOptions {
  type: "summary" | "detailed";
  config?: ReportConfig;
  gscImpressions?: number | null;
}

export interface RawDbResults {
  project: RawProject;
  crawl: RawCrawl;
  pageScores: RawPageScore[];
  issues: RawIssue[];
  historyCrawls: {
    id: string;
    completedAt: string | Date | null;
    pagesScored: number | null;
    avgOverall: number;
    avgTechnical: number;
    avgContent: number;
    avgAiReadiness: number;
    avgPerformance: number;
  }[];
  visibilityChecks: RawVisibilityCheck[];
  enrichments?: RawEnrichment[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getLetterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function average(nums: (number | null | undefined)[]): number {
  const valid = nums.filter((n): n is number => n != null);
  if (valid.length === 0) return 0;
  return (
    Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
  );
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export function aggregateReportData(
  raw: RawDbResults,
  options: AggregateOptions,
): ReportData {
  const {
    project,
    crawl,
    pageScores,
    issues,
    historyCrawls,
    visibilityChecks,
  } = raw;

  // Compute average scores
  const overall = average(pageScores.map((p) => p.overallScore));
  const technical = average(pageScores.map((p) => p.technicalScore));
  const content = average(pageScores.map((p) => p.contentScore));
  const aiReadiness = average(pageScores.map((p) => p.aiReadinessScore));
  const performanceAvg = average(
    pageScores.map((p) => {
      const perf = p.lighthousePerf ?? 0;
      const seo = p.lighthouseSeo ?? 0;
      return Math.round(((perf + seo) / 2) * 100);
    }),
  );

  // Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const p of pageScores) {
    const g = getLetterGrade(p.overallScore) as keyof typeof grades;
    grades[g]++;
  }
  const total = pageScores.length || 1;
  const gradeDistribution = Object.entries(grades).map(([grade, count]) => ({
    grade,
    count,
    percentage: Math.round((count / total) * 100),
  }));

  // Group issues by severity and category
  const severityMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const issueCodeMap = new Map<string, { issue: RawIssue; count: number }>();

  for (const issue of issues) {
    severityMap.set(issue.severity, (severityMap.get(issue.severity) ?? 0) + 1);
    categoryMap.set(issue.category, (categoryMap.get(issue.category) ?? 0) + 1);

    const existing = issueCodeMap.get(issue.code);
    if (existing) {
      existing.count++;
    } else {
      issueCodeMap.set(issue.code, { issue, count: 1 });
    }
  }

  const reportIssues: ReportIssue[] = Array.from(issueCodeMap.entries())
    .map(([code, { issue, count }]) => {
      const deduction =
        issue.severity === "critical"
          ? 8
          : issue.severity === "warning"
            ? 4
            : 2;
      const roi = estimateIssueROI({
        code,
        severity: issue.severity as "critical" | "warning" | "info",
        scoreDeduction: deduction,
        affectedPages: count,
        totalPages: pageScores.length,
        gscImpressions: options.gscImpressions ?? null,
      });
      return {
        code,
        category: issue.category,
        severity: issue.severity,
        message: issue.message,
        recommendation: issue.recommendation ?? "",
        affectedPages: count,
        scoreImpact: deduction,
        roi,
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };
      const severityDiff = (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      if (severityDiff !== 0) return severityDiff;
      return b.affectedPages - a.affectedPages;
    });

  // Quick wins: top 10 high-impact, low-effort issues
  const quickWins: ReportQuickWin[] = reportIssues
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .slice(0, 10)
    .map((i) => ({
      code: i.code,
      message: i.message,
      recommendation: i.recommendation,
      effort:
        i.severity === "critical" ? ("low" as const) : ("medium" as const),
      affectedPages: i.affectedPages,
      scoreImpact: i.scoreImpact,
      roi: i.roi!,
    }));

  // Pages (sorted worst-first)
  const reportPages: ReportPageScore[] = pageScores
    .map((p) => ({
      url: p.url,
      title: p.title,
      overall: p.overallScore,
      technical: p.technicalScore ?? 0,
      content: p.contentScore ?? 0,
      aiReadiness: p.aiReadinessScore ?? 0,
      performance: Math.round(
        (((p.lighthousePerf ?? 0) + (p.lighthouseSeo ?? 0)) / 2) * 100,
      ),
      grade: getLetterGrade(p.overallScore),
      issueCount: p.issueCount ?? 0,
    }))
    .sort((a, b) => a.overall - b.overall);

  // History
  const history: ReportHistoryPoint[] = historyCrawls.map((c) => ({
    crawlId: c.id,
    completedAt:
      typeof c.completedAt === "string"
        ? c.completedAt
        : (c.completedAt?.toISOString() ?? ""),
    overall: c.avgOverall,
    technical: c.avgTechnical,
    content: c.avgContent,
    aiReadiness: c.avgAiReadiness,
    performance: c.avgPerformance,
    pagesScored: c.pagesScored ?? 0,
  }));

  // Visibility
  let visibility: ReportVisibility | null = null;
  if (visibilityChecks.length > 0) {
    const platformMap = new Map<
      string,
      {
        mentions: number;
        citations: number;
        positions: number[];
        count: number;
      }
    >();
    for (const check of visibilityChecks) {
      const p = platformMap.get(check.llmProvider) ?? {
        mentions: 0,
        citations: 0,
        positions: [],
        count: 0,
      };
      p.count++;
      if (check.brandMentioned) p.mentions++;
      if (check.urlCited) p.citations++;
      if (check.citationPosition != null)
        p.positions.push(check.citationPosition);
      platformMap.set(check.llmProvider, p);
    }
    visibility = {
      platforms: Array.from(platformMap.entries()).map(([provider, data]) => ({
        provider,
        brandMentionRate: Math.round((data.mentions / data.count) * 100),
        urlCitationRate: Math.round((data.citations / data.count) * 100),
        avgPosition:
          data.positions.length > 0
            ? Math.round(average(data.positions))
            : null,
        checksCount: data.count,
      })),
    };
  }

  // Competitors + gap queries
  const competitorAnalysis = aggregateCompetitors(visibilityChecks);
  const competitors = competitorAnalysis?.competitors ?? null;
  const gapQueries = competitorAnalysis?.gapQueries ?? null;

  // Content health (from LLM scores in page detail)
  let contentHealth: ReportContentHealth | null = null;
  const llmScores = pageScores
    .map((p) => (p.detail as any)?.llmContentScores)
    .filter(Boolean);
  if (llmScores.length > 0 || pageScores.length > 0) {
    const wordCounts = pageScores.map((p) => {
      const ext = (p.detail as any)?.extracted;
      return ext?.text_length ?? 0;
    });
    contentHealth = {
      avgWordCount: Math.round(average(wordCounts)),
      avgClarity: llmScores.length
        ? average(llmScores.map((s: any) => s.clarity))
        : null,
      avgAuthority: llmScores.length
        ? average(llmScores.map((s: any) => s.authority))
        : null,
      avgComprehensiveness: llmScores.length
        ? average(llmScores.map((s: any) => s.comprehensiveness))
        : null,
      avgStructure: llmScores.length
        ? average(llmScores.map((s: any) => s.structure))
        : null,
      avgCitationWorthiness: llmScores.length
        ? average(llmScores.map((s: any) => s.citation_worthiness))
        : null,
      pagesAboveThreshold: wordCounts.filter((w) => w >= 300).length,
      totalPages: pageScores.length,
    };
  }

  return {
    project: {
      name: project.name,
      domain: project.domain,
      branding: project.branding as ReportData["project"]["branding"],
    },
    crawl: {
      id: crawl.id,
      completedAt:
        typeof crawl.completedAt === "string"
          ? crawl.completedAt
          : (crawl.completedAt?.toISOString() ?? ""),
      pagesFound: crawl.pagesFound ?? 0,
      pagesCrawled: crawl.pagesCrawled ?? 0,
      pagesScored: crawl.pagesScored ?? 0,
      summary: crawl.summary,
    },
    scores: {
      overall,
      technical,
      content,
      aiReadiness,
      performance: performanceAvg,
      letterGrade: getLetterGrade(overall),
    },
    issues: {
      bySeverity: Array.from(severityMap.entries()).map(
        ([severity, count]) => ({ severity, count }),
      ),
      byCategory: Array.from(categoryMap.entries()).map(
        ([category, count]) => ({ category, count }),
      ),
      total: issues.length,
      items: reportIssues,
    },
    gradeDistribution,
    quickWins,
    pages: reportPages,
    history,
    visibility,
    competitors,
    gapQueries,
    contentHealth,
    platformOpportunities: null, // Computed from visibility data in a later step
    integrations: raw.enrichments
      ? aggregateIntegrations(raw.enrichments)
      : null,
    config: options.config ?? {},
  };
}
