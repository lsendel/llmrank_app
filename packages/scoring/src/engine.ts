import type { PageData, ScoringResult } from "./types";
import { scoreTechnicalFactors } from "./factors/technical";
import { scoreContentFactors } from "./factors/content";
import { scoreAiReadinessFactors } from "./factors/ai-readiness";
import { scorePerformanceFactors } from "./factors/performance";
import type { Issue } from "@llm-boost/shared";
import { calculatePlatformScores, type PlatformScores } from "./platforms";
import {
  normalizeWeights,
  DEFAULT_WEIGHTS,
  type ScoringWeights,
} from "./profiles";

const WEIGHTS = normalizeWeights(DEFAULT_WEIGHTS);

function getLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scorePage(
  page: PageData,
  customWeights?: ScoringWeights,
): ScoringResult {
  // Special case: 4xx/5xx pages get 0
  if (page.statusCode >= 400) {
    return {
      overallScore: 0,
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

  const w = customWeights ? normalizeWeights(customWeights) : WEIGHTS;

  const technical = scoreTechnicalFactors(page);
  const content = scoreContentFactors(page);
  const aiReadiness = scoreAiReadinessFactors(page);
  const performance = scorePerformanceFactors(page);
  const platformScores = calculatePlatformScores({
    technicalScore: technical.score,
    contentScore: content.score,
    aiReadinessScore: aiReadiness.score,
    performanceScore: performance.score,
  });

  const overallScore = Math.round(
    technical.score * w.technical +
      content.score * w.content +
      aiReadiness.score * w.ai_readiness +
      performance.score * w.performance,
  );

  const allIssues: Issue[] = [
    ...technical.issues,
    ...content.issues,
    ...aiReadiness.issues,
    ...performance.issues,
  ];

  // Sort: critical > warning > info, then by score impact
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allIssues.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return {
    overallScore,
    technicalScore: technical.score,
    contentScore: content.score,
    aiReadinessScore: aiReadiness.score,
    performanceScore: performance.score,
    letterGrade: getLetterGrade(overallScore),
    platformScores,
    issues: allIssues,
  };
}
