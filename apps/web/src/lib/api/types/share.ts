import type { RecommendationConfidence } from "./recommendations";

export interface ShareInfo {
  shareToken: string;
  shareUrl: string;
  badgeUrl: string;
  level: "summary" | "issues" | "full";
  expiresAt: string | null;
}

export interface PublicReport {
  shareLevel: string;
  crawlId: string;
  projectId: string;
  completedAt: string;
  pagesScored: number;
  pagesCrawled?: number;
  summary: string | null;
  summaryData: {
    overallScore: number;
    letterGrade: string;
    categoryScores: {
      technical: number;
      content: number;
      aiReadiness: number;
      performance: number;
    };
    quickWins: unknown[];
  } | null;
  project: { name: string; domain: string; branding: unknown };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  pages: Array<{
    url: string;
    title: string;
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    aiReadinessScore: number;
    issueCount: number;
  }>;
  issueCount: number;
  readinessCoverage: Record<string, number>;
  scoreDeltas: Record<string, number> | null;
  quickWins: Array<{
    code: string;
    category: string;
    severity: string;
    scoreImpact: number;
    effortLevel: string;
    message: string;
    recommendation: string;
    affectedPages: number;
    dataTimestamp?: string | null;
    confidence?: RecommendationConfidence;
  }>;
}
