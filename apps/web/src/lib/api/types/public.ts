import type { SiteContext } from "./crawls";
import type {
  DashboardCoverageMetric,
  DashboardScoreDeltas,
} from "./dashboard";
import type { PageIssue } from "./pages";
import type { QuickWin } from "./quick-wins";

export interface PublicScanResult {
  id?: string;
  scanResultId?: string;
  url: string;
  domain: string;
  createdAt?: string;
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  issues: PageIssue[];
  quickWins?: QuickWin[];
  meta?: {
    title: string | null;
    description: string | null;
    wordCount: number;
    hasLlmsTxt: boolean;
    hasSitemap: boolean;
    sitemapUrls: number;
    aiCrawlersBlocked: string[];
    schemaTypes: string[];
    ogTags: Record<string, string>;
    siteContext?: SiteContext;
  };
  siteContext?: SiteContext;
  visibility?:
    | {
        provider: string;
        brandMentioned: boolean;
        urlCited: boolean;
        citationPosition?: number | null;
        competitorMentions?:
          | { domain: string; mentioned: boolean; position: number | null }[]
          | null;
      }[]
    | { provider: string; brandMentioned: boolean; urlCited: boolean }
    | null;
}

export interface IntegrationCatalogItem {
  id: string;
  provider: "gsc" | "ga4" | null;
  name: string;
  description: string;
  features: string[];
  availability: "available_now" | "coming_soon";
  access: "public" | "requires_auth";
  minPlan: "pro" | "agency" | null;
  authType: "oauth2" | "api_key";
  link?: string;
}

export interface SharedReport {
  crawlId: string;
  projectId: string;
  completedAt: string | null;
  pagesScored: number;
  pagesCrawled?: number;
  summary: string | null;
  summaryData?: unknown;
  project: {
    name: string;
    domain: string;
    branding?: {
      logoUrl?: string;
      companyName?: string;
      primaryColor?: string;
    };
  };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  pages: {
    url: string;
    title: string | null;
    overallScore: number;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    issueCount: number;
  }[];
  issueCount: number;
  quickWins: QuickWin[];
  readinessCoverage: DashboardCoverageMetric[];
  scoreDeltas: DashboardScoreDeltas;
}
