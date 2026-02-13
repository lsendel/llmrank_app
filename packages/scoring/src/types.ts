import type {
  ExtractedData,
  LighthouseResult,
  LLMContentScores,
  Issue,
} from "@llm-boost/shared";

export interface PageData {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  wordCount: number;
  contentHash: string;
  extracted: ExtractedData;
  lighthouse: LighthouseResult | null;
  llmScores: LLMContentScores | null;
  // Site-level data passed in for cross-page checks
  siteContext?: {
    hasLlmsTxt: boolean;
    aiCrawlersBlocked: string[];
    hasSitemap: boolean;
    contentHashes: Map<string, string>; // hash -> other page URL (for duplicate detection)
    responseTimeMs?: number;
    pageSizeBytes?: number;
  };
}

export interface FactorResult {
  score: number;
  issues: Issue[];
}

export interface ScoringResult {
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
  letterGrade: "A" | "B" | "C" | "D" | "F";
  issues: Issue[];
}
