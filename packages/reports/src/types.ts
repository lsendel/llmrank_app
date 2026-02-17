import type { ReportConfig } from "@llm-boost/shared";

export type ReportType = "summary" | "detailed";
export type ReportFormat = "pdf" | "docx";

export type ReportPillar = "technical" | "content" | "ai_readiness";

export interface ReportData {
  project: {
    name: string;
    domain: string;
    branding?: {
      logoUrl?: string;
      companyName?: string;
      primaryColor?: string;
    };
  };
  crawl: {
    id: string;
    completedAt: string;
    pagesFound: number;
    pagesCrawled: number;
    pagesScored: number;
    summary: string | null;
  };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number | null;
    letterGrade: string;
  };
  issues: {
    bySeverity: { severity: string; count: number }[];
    byCategory: { category: string; count: number }[];
    total: number;
    items: ReportIssue[];
  };
  gradeDistribution: { grade: string; count: number; percentage: number }[];
  quickWins: ReportQuickWin[];
  pages: ReportPageScore[];
  history: ReportHistoryPoint[];
  visibility: ReportVisibility | null;
  competitors: ReportCompetitor[] | null;
  gapQueries: GapQuery[] | null;
  contentHealth: ReportContentHealth | null;
  platformOpportunities: ReportPlatformOpportunity[] | null;
  integrations: ReportIntegrationData | null;
  readinessCoverage: ReportCoverageMetric[];
  actionPlan: ReportActionPlanTier[];
  scoreDeltas: ReportScoreDeltas;
  config: ReportConfig;
  isPublic?: boolean;
}

export interface ReportIssue {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string;
  affectedPages: number;
  scoreImpact: number;
  roi: ReportROI | null;
  pillar: ReportPillar;
  owner: string;
  effort: "low" | "medium" | "high";
  docsUrl?: string;
  label?: string;
}

export interface ReportROI {
  scoreImpact: number;
  pageReach: number;
  visibilityImpact: "high" | "medium" | "low";
  trafficEstimate: string | null;
}

export interface ReportQuickWin {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string;
  effort: "low" | "medium" | "high";
  affectedPages: number;
  scoreImpact: number;
  roi: ReportROI;
  pillar: ReportPillar;
  owner: string;
  docsUrl?: string;
}

export interface ReportPageScore {
  url: string;
  title: string | null;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number | null;
  grade: string;
  issueCount: number;
}

export interface ReportHistoryPoint {
  crawlId: string;
  completedAt: string;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  pagesScored: number;
}

export interface ReportVisibility {
  platforms: {
    provider: string;
    brandMentionRate: number;
    urlCitationRate: number;
    avgPosition: number | null;
    checksCount: number;
  }[];
}

export interface ReportScoreDeltas {
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export interface ReportCoverageMetric {
  code: string;
  label: string;
  description: string;
  pillar: ReportPillar;
  coveragePercent: number;
  affectedPages: number;
  totalPages: number;
}

export interface ReportActionPlanTier {
  title: string;
  description: string;
  items: ReportIssue[];
}

export interface ReportCompetitor {
  domain: string;
  mentionCount: number;
  platforms: string[];
  queries: string[];
}

export interface ReportPlatformOpportunity {
  platform: string;
  currentScore: number;
  opportunityScore: number;
  topTips: string[];
}

export interface ReportContentHealth {
  avgWordCount: number;
  avgClarity: number | null;
  avgAuthority: number | null;
  avgComprehensiveness: number | null;
  avgStructure: number | null;
  avgCitationWorthiness: number | null;
  pagesAboveThreshold: number;
  totalPages: number;
}

export interface GapQuery {
  query: string;
  platform: string;
  competitorsCited: string[];
}

export interface ReportIntegrationData {
  gsc: {
    topQueries: {
      query: string;
      impressions: number;
      clicks: number;
      position: number;
    }[];
  } | null;
  ga4: {
    bounceRate: number;
    avgEngagement: number;
    topPages: { url: string; sessions: number }[];
  } | null;
  clarity: { avgUxScore: number; rageClickPages: string[] } | null;
}

export interface GenerateReportJob {
  reportId: string;
  projectId: string;
  crawlJobId: string;
  userId: string;
  type: ReportType;
  format: ReportFormat;
  config: ReportConfig;
  isPublic?: boolean;
}
