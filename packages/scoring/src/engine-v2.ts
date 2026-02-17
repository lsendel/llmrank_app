/**
 * engine-v2.ts — 7-dimension scoring engine.
 *
 * Calls each of the 7 dimension scorers, computes a weighted overall score,
 * and returns a ScoringResultV2 that includes both the new dimension scores
 * and backwards-compatible legacy 4-pillar scores.
 */

import type { PageData, ScoringResultV2 } from "./types";
import type {
  Issue,
  DimensionScores,
  DimensionWeights,
} from "@llm-boost/shared";
import { DIMENSION_IDS, DEFAULT_DIMENSION_WEIGHTS } from "@llm-boost/shared";
import {
  scoreLlmsTxt,
  scoreRobotsCrawlability,
  scoreSitemap,
  scoreSchemaMarkup,
  scoreMetaTags,
  scoreBotAccess,
  scoreContentCiteability,
} from "./dimensions";
import { dimensionsToLegacyScores } from "./dimension-adapter";
import { calculatePlatformScores, type PlatformScores } from "./platforms";
import type { FactorResult } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Normalise dimension weights so they sum to exactly 1.0.
 * This mirrors the normalizeWeights() helper used in v1 for the 4-pillar model.
 */
function normalizeDimensionWeights(w: DimensionWeights): DimensionWeights {
  const total = DIMENSION_IDS.reduce((sum, id) => sum + w[id], 0);
  if (total === 0) return DEFAULT_DIMENSION_WEIGHTS;

  const result = {} as Record<string, number>;
  for (const id of DIMENSION_IDS) {
    result[id] = w[id] / total;
  }
  return result as DimensionWeights;
}

// Pre-compute normalised default weights (should already sum to 1.0, but be safe)
const WEIGHTS = normalizeDimensionWeights(DEFAULT_DIMENSION_WEIGHTS);

// ---------------------------------------------------------------------------
// Dimension scorer dispatch map
// ---------------------------------------------------------------------------

type DimensionScorer = (page: PageData) => FactorResult;

const DIMENSION_SCORERS: Record<
  (typeof DIMENSION_IDS)[number],
  DimensionScorer
> = {
  llms_txt: scoreLlmsTxt,
  robots_crawlability: scoreRobotsCrawlability,
  sitemap: scoreSitemap,
  schema_markup: scoreSchemaMarkup,
  meta_tags: scoreMetaTags,
  bot_access: scoreBotAccess,
  content_citeability: scoreContentCiteability,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Score a page using the 7-dimension model.
 *
 * @param page           Page data collected during crawl
 * @param customWeights  Optional per-dimension weights (will be normalised)
 * @returns ScoringResultV2 with dimension scores, legacy compat scores, and issues
 */
export function scorePageV2(
  page: PageData,
  customWeights?: DimensionWeights,
): ScoringResultV2 {
  // Special case: 4xx/5xx pages get all zeros (mirrors v1 behaviour)
  if (page.statusCode >= 400) {
    const zeroDimensions = {} as Record<string, number>;
    for (const id of DIMENSION_IDS) {
      zeroDimensions[id] = 0;
    }
    return {
      overallScore: 0,
      dimensionScores: zeroDimensions as DimensionScores,
      technicalScore: 0,
      contentScore: 0,
      aiReadinessScore: 0,
      performanceScore: 0,
      platformScores: {} as PlatformScores,
      letterGrade: "F",
      issues: [
        {
          code: "HTTP_STATUS",
          category: "technical",
          severity: "critical",
          message: `Page returned HTTP ${page.statusCode}`,
          recommendation: "Fix the server error or set up a redirect.",
          data: { statusCode: page.statusCode },
        },
      ],
    };
  }

  // Resolve weights
  const w = customWeights ? normalizeDimensionWeights(customWeights) : WEIGHTS;

  // Run all 7 dimension scorers
  const dimScores = {} as Record<string, number>;
  const allIssues: Issue[] = [];

  for (const id of DIMENSION_IDS) {
    const result = DIMENSION_SCORERS[id](page);
    dimScores[id] = result.score;
    allIssues.push(...result.issues);
  }

  const dimensionScores = dimScores as DimensionScores;

  // Compute weighted overall score
  const overallScore = Math.round(
    DIMENSION_IDS.reduce((sum, id) => sum + dimensionScores[id] * w[id], 0),
  );

  // Sort issues: critical > warning > info
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  allIssues.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  // Derive legacy 4-pillar scores for backwards compatibility
  const legacy = dimensionsToLegacyScores(dimensionScores);

  // Compute platform scores using the legacy pillar scores
  const platformScores = calculatePlatformScores({
    technicalScore: legacy.technicalScore,
    contentScore: legacy.contentScore,
    aiReadinessScore: legacy.aiReadinessScore,
    performanceScore: legacy.performanceScore,
  });

  return {
    overallScore,
    dimensionScores,
    technicalScore: legacy.technicalScore,
    contentScore: legacy.contentScore,
    aiReadinessScore: legacy.aiReadinessScore,
    performanceScore: legacy.performanceScore,
    letterGrade: getLetterGrade(overallScore),
    platformScores,
    issues: allIssues,
  };
}
