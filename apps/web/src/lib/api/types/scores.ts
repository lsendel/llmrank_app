import type { PageIssue } from "./pages";

export interface PageScoreEntry {
  id: string;
  pageId: string;
  url: string;
  title: string | null;
  statusCode: number | null;
  wordCount: number | null;
  overallScore: number;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  letterGrade: string;
  detail: Record<string, unknown> | null;
}

export interface PageScoreDetail {
  id: string;
  jobId: string;
  url: string;
  canonicalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  metaDesc: string | null;
  wordCount: number | null;
  contentType?: string | null;
  textLength?: number | null;
  htmlLength?: number | null;
  contentHash: string | null;
  crawledAt: string | null;
  score: {
    overallScore: number;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    lighthousePerf: number | null;
    lighthouseSeo: number | null;
    letterGrade: string;
    detail: Record<string, unknown>;
    platformScores: Record<
      string,
      { score: number; grade: string; tips: string[] }
    > | null;
    recommendations: Array<{
      issueCode: string;
      title: string;
      description: string;
      priority: string;
      effort: string;
      impact: string;
      estimatedImprovement: number;
      affectedPlatforms: string[];
      steps?: string[];
      example?: { before: string; after: string };
    }> | null;
  } | null;
  issues: PageIssue[];
}
