import type { QuickWin } from "./quick-wins";

export interface ComparisonItem {
  url: string;
  oldScore: number | null;
  newScore: number | null;
  delta: number;
}

/** One row of a crawl's SQL-side issue aggregation (GROUP BY code). */
export interface IssueCodeCount {
  code: string;
  category: string;
  severity: string;
  count: number;
}

export interface SiteContext {
  hasLlmsTxt: boolean;
  aiCrawlersBlocked: string[];
  hasSitemap: boolean;
  sitemapAnalysis?: {
    isValid: boolean;
    urlCount: number;
    staleUrlCount: number;
    discoveredPageCount: number;
  };
  contentHashes: Record<string, string>;
  responseTimeMs?: number;
  pageSizeBytes?: number;
}

export interface CrawlSummaryData {
  project: { id: string; name: string; domain: string };
  overallScore: number;
  letterGrade: string;
  categoryScores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  quickWins: QuickWin[];
  pagesScored: number;
  generatedAt: string;
  issueCount: number;
  siteContext?: SiteContext;
}

export interface CrawlJob {
  id: string;
  projectId: string;
  status:
    | "pending"
    | "queued"
    | "crawling"
    | "scoring"
    | "complete"
    | "failed"
    | "cancelled";
  config?: {
    maxPages?: number;
    maxDepth?: number;
    [key: string]: unknown;
  } | null;
  startedAt: string | null;
  completedAt: string | null;
  pagesFound: number;
  pagesCrawled: number;
  pagesScored: number;
  pagesErrored: number;
  overallScore: number | null;
  letterGrade: string | null;
  scores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number | null;
  } | null;
  errorMessage: string | null;
  summary: string | null;
  summaryData?: CrawlSummaryData | null;
  createdAt: string;
  projectName?: string;
  projectId2?: string;
}

export interface AIAuditCheck {
  name: string;
  score: number;
  status: "pass" | "warn" | "fail";
}

export interface AIAuditResult {
  checks: AIAuditCheck[];
  issueCount: number;
  criticalCount: number;
  pagesAudited: number;
}

export interface CrawlJobSummary {
  id: string;
  projectId: string;
  projectName: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pagesFound?: number;
  pagesCrawled?: number;
  pagesScored?: number;
  errorMessage: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
}

export interface CrawlInsights {
  issueDistribution: {
    bySeverity: { severity: string; count: number }[];
    byCategory: { category: string; count: number }[];
    total: number;
  };
  scoreRadar: {
    technical: number;
    content: number;
    aiReadiness: number;
    /** null when no Lighthouse data was collected ("not measured"). */
    performance: number | null;
  };
  gradeDistribution: { grade: string; count: number; percentage: number }[];
  contentRatio: {
    avgWordCount: number;
    avgHtmlToTextRatio: number;
    pagesAboveThreshold: number;
    totalPages: number;
    totalTextLength: number;
    totalHtmlLength: number;
  };
  crawlProgress: {
    found: number;
    crawled: number;
    scored: number;
    errored: number;
    status: string;
  };
}

export interface IssueHeatmapData {
  categories: string[];
  pages: Array<{ url: string; pageId: string; issues: Record<string, string> }>;
}

export interface PlatformOpportunity {
  platform: string;
  currentScore: number;
  opportunityScore: number;
  topTips: string[];
  visibilityRate: number | null;
}

export interface FusedInsights {
  aiVisibilityReadiness: number;
  platformOpportunities: PlatformOpportunity[];
  contentHealthMatrix: {
    scoring: number;
    llmQuality: number | null;
    /** Pages that received LLM content scoring (denominator numerator for llmQuality). */
    llmScoredPages: number;
    /** Total scored pages in the crawl (llmQuality samples llmScoredPages of these). */
    totalPages: number;
    engagement: number | null;
    uxQuality: number | null;
  };
  roiQuickWins: Array<{
    issueCode: string;
    scoreImpact: number;
    estimatedTrafficImpact: number | null;
    effort: "low" | "medium" | "high";
    affectedPages: number;
  }>;
}
