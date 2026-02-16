import type {
  ReportData,
  ReportIssue,
  ReportQuickWin,
  ReportPageScore,
  ReportHistoryPoint,
  ReportVisibility,
  ReportContentHealth,
  ReportCoverageMetric,
  ReportActionPlanTier,
  ReportPillar,
  ReportScoreDeltas,
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
  pageId?: string;
  url: string;
  title: string | null;
  overallScore: number;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  detail: Record<string, unknown> | null;
  wordCount?: number | null;
  issueCount?: number;
}

export interface RawIssue {
  pageId?: string;
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
  isPublic?: boolean;
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

type IssueMetadata = {
  label: string;
  pillar: ReportPillar;
  owner: string;
  effort: "low" | "medium" | "high";
  docsUrl?: string;
  coverageDescription?: string;
  includeInCoverage?: boolean;
};

const DEFAULT_ISSUE_METADATA: IssueMetadata = {
  label: "Site hygiene",
  pillar: "technical",
  owner: "SEO",
  effort: "medium",
};

const ISSUE_METADATA: Record<string, IssueMetadata> = {
  MISSING_TITLE: {
    label: "Title Tags",
    pillar: "technical",
    owner: "SEO",
    effort: "low",
    docsUrl: "https://developers.google.com/search/docs/appearance/title-link",
    coverageDescription: "Pages with descriptive 30-60 character titles",
    includeInCoverage: true,
  },
  MISSING_META_DESC: {
    label: "Meta Descriptions",
    pillar: "technical",
    owner: "SEO",
    effort: "medium",
    docsUrl: "https://developers.google.com/search/docs/appearance/snippet",
    coverageDescription: "Pages with 120-160 character meta descriptions",
    includeInCoverage: true,
  },
  MISSING_CANONICAL: {
    label: "Canonical Tags",
    pillar: "technical",
    owner: "Engineering",
    effort: "medium",
    docsUrl:
      "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    coverageDescription: "Pages that declare a canonical URL",
    includeInCoverage: true,
  },
  THIN_CONTENT: {
    label: "Content Depth",
    pillar: "content",
    owner: "Content",
    effort: "high",
    docsUrl:
      "https://developers.google.com/search/blog/2022/08/helpful-content-update",
    coverageDescription: "Pages meeting the 500-word threshold",
    includeInCoverage: true,
  },
  NO_STRUCTURED_DATA: {
    label: "Structured Data",
    pillar: "ai_readiness",
    owner: "Engineering",
    effort: "medium",
    docsUrl:
      "https://developers.google.com/search/docs/appearance/structured-data",
    coverageDescription: "Pages with JSON-LD schema",
    includeInCoverage: true,
  },
  MISSING_H1: {
    label: "H1 Usage",
    pillar: "technical",
    owner: "Content",
    effort: "low",
    coverageDescription: "Pages with a single descriptive H1",
    includeInCoverage: true,
  },
  NO_INTERNAL_LINKS: {
    label: "Internal Links",
    pillar: "content",
    owner: "SEO",
    effort: "medium",
    coverageDescription: "Pages referencing 2+ internal resources",
    includeInCoverage: true,
  },
  MISSING_OG_TAGS: {
    label: "Open Graph Tags",
    pillar: "ai_readiness",
    owner: "Marketing",
    effort: "low",
    coverageDescription: "Pages with og:title/description/image",
    includeInCoverage: true,
  },
  MISSING_AUTHORITATIVE_CITATIONS: {
    label: "Authoritative Citations",
    pillar: "ai_readiness",
    owner: "Content",
    effort: "medium",
    coverageDescription: "Pages citing high-trust sources",
    includeInCoverage: true,
  },
  MISSING_LLMS_TXT: {
    label: "llms.txt",
    pillar: "ai_readiness",
    owner: "Engineering",
    effort: "low",
    docsUrl: "https://llmspecs.com/llms-txt",
  },
};

const COVERAGE_CODES = Object.entries(ISSUE_METADATA)
  .filter(([, meta]) => meta.includeInCoverage)
  .map(([code]) => code);

function buildActionPlanTiers(issues: ReportIssue[]): ReportActionPlanTier[] {
  const critical = issues.filter((i) => i.severity === "critical");
  const warning = issues.filter((i) => i.severity === "warning");
  const quickWins = warning.filter(
    (i) => i.effort === "low" || i.effort === "medium",
  );
  const strategic = warning.filter((i) => i.effort === "high");
  const info = issues.filter((i) => i.severity === "info");

  return [
    {
      title: "Priority 1: Critical Fixes",
      description:
        "Address immediately — these items block AI visibility or create crawl errors.",
      items: critical,
    },
    {
      title: "Priority 2: Quick Wins",
      description:
        "High-impact changes that require light engineering/content effort.",
      items: quickWins,
    },
    {
      title: "Priority 3: Strategic Improvements",
      description:
        "Medium-term improvements that compound over subsequent crawls.",
      items: strategic,
    },
    {
      title: "Priority 4: Long-term Optimization",
      description:
        "Nice-to-have improvements that polish experience and trust signals.",
      items: info,
    },
  ].filter((tier) => tier.items.length > 0);
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
      const metadata = ISSUE_METADATA[code] ?? DEFAULT_ISSUE_METADATA;
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
        pillar: metadata.pillar,
        owner: metadata.owner,
        effort: metadata.effort,
        docsUrl: metadata.docsUrl,
        label: metadata.label,
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
      category: i.category,
      severity: i.severity,
      message: i.message,
      recommendation: i.recommendation,
      effort:
        i.severity === "critical" ? ("low" as const) : ("medium" as const),
      affectedPages: i.affectedPages,
      scoreImpact: i.scoreImpact,
      roi: i.roi!,
      pillar: i.pillar,
      owner: i.owner,
      docsUrl: i.docsUrl,
    }));

  const totalPages = Math.max(pageScores.length, 1);
  const readinessCoverage: ReportCoverageMetric[] = COVERAGE_CODES.map(
    (code) => {
      const issue = reportIssues.find((i) => i.code === code);
      const meta = ISSUE_METADATA[code] ?? DEFAULT_ISSUE_METADATA;
      const affected = issue?.affectedPages ?? 0;
      const coveragePercent = Math.max(
        0,
        Math.round(((totalPages - affected) / totalPages) * 100),
      );
      return {
        code,
        label: meta.label,
        description:
          meta.coverageDescription ?? `${meta.label} coverage across pages`,
        pillar: meta.pillar,
        coveragePercent,
        affectedPages: affected,
        totalPages,
      };
    },
  ).sort((a, b) => a.coveragePercent - b.coveragePercent);

  // Count issues per page from raw issue rows
  const issueCountByPageId = new Map<string, number>();
  for (const issue of issues) {
    if (issue.pageId) {
      issueCountByPageId.set(
        issue.pageId,
        (issueCountByPageId.get(issue.pageId) ?? 0) + 1,
      );
    }
  }

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
      issueCount: p.pageId
        ? (issueCountByPageId.get(p.pageId) ?? 0)
        : (p.issueCount ?? 0),
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

  const scoreDeltas: ReportScoreDeltas = {
    overall: 0,
    technical: 0,
    content: 0,
    aiReadiness: 0,
    performance: 0,
  };
  if (history.length >= 2) {
    const previous = history[history.length - 2];
    scoreDeltas.overall = Math.round(overall - previous.overall);
    scoreDeltas.technical = Math.round(technical - previous.technical);
    scoreDeltas.content = Math.round(content - previous.content);
    scoreDeltas.aiReadiness = Math.round(aiReadiness - previous.aiReadiness);
    scoreDeltas.performance = Math.round(performanceAvg - previous.performance);
  }

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
    const wordCounts = pageScores.map((p) => p.wordCount ?? 0);
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

  const actionPlan = buildActionPlanTiers(reportIssues);

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
    readinessCoverage,
    pages: reportPages,
    history,
    scoreDeltas,
    visibility,
    competitors,
    gapQueries,
    contentHealth,
    platformOpportunities: null, // Computed from visibility data in a later step
    integrations: raw.enrichments
      ? aggregateIntegrations(raw.enrichments)
      : null,
    actionPlan,
    config: options.config ?? {},
    isPublic: options.isPublic,
  };
}
