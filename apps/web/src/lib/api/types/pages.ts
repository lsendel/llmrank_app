export interface CrawledPage {
  id: string;
  crawlId: string;
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  overallScore: number | null;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  performanceScore: number | null;
  letterGrade: string | null;
  issueCount: number;
  isCrossDomainRedirect?: boolean;
  redirectUrl?: string | null;
}

export interface PageIssue {
  code: string;
  category: "technical" | "content" | "ai_readiness" | "performance";
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
  data?: Record<string, unknown>;
  pageId?: string;
  pageUrl?: string | null;
}

export interface PageDetail extends CrawledPage {
  canonicalUrl: string | null;
  extracted: {
    h1: string[];
    h2: string[];
    schemaTypes: string[];
    internalLinks: string[];
    externalLinks: string[];
    imagesWithoutAlt: number;
    hasRobotsMeta: boolean;
  };
  lighthouse: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  } | null;
  issues: PageIssue[];
}

export interface PageEnrichment {
  id: string;
  pageId: string;
  jobId: string;
  provider: "gsc" | "psi" | "ga4" | "clarity" | "meta";
  data: Record<string, unknown>;
  fetchedAt: string;
}
