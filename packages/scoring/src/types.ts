import type {
  ExtractedData,
  LighthouseResult,
  LLMContentScores,
  Issue,
  LLMPlatformId,
  DimensionScores,
} from "@llm-boost/shared";
import type { PlatformScoreResult } from "./platforms";

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
  // Redirect chain from fetcher
  redirectChain?: Array<{ url: string; status_code: number }>;
  // Site-level data passed in for cross-page checks
  siteContext?: {
    hasLlmsTxt: boolean;
    aiCrawlersBlocked: string[];
    hasSitemap: boolean;
    sitemapAnalysis?: {
      isValid: boolean;
      urlCount: number;
      staleUrlCount: number;
      discoveredPageCount: number;
    };
    contentHashes: Map<string, string>; // hash -> other page URL (for duplicate detection)
    responseTimeMs?: number;
    pageSizeBytes?: number;
    llmsTxtContent?: string;
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
  platformScores: Record<LLMPlatformId, PlatformScoreResult>;
  issues: Issue[];
}

export interface ScoringResultV2 {
  overallScore: number;
  dimensionScores: DimensionScores;
  // Legacy compat fields (derived from dimensionsToLegacyScores)
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
  letterGrade: "A" | "B" | "C" | "D" | "F";
  platformScores: Record<LLMPlatformId, PlatformScoreResult>;
  issues: Issue[];
}
