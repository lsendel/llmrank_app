import {
  LLM_PLATFORMS,
  PLATFORM_TIPS,
  PLATFORM_WEIGHTS,
} from "@llm-boost/shared";
import type { LLMPlatformId } from "@llm-boost/shared";

export interface PlatformScoreResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  tips: string[];
}

export type PlatformScores = Record<LLMPlatformId, PlatformScoreResult>;

interface CategoryScores {
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
}

function letterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function calculatePlatformScores(
  categories: CategoryScores,
): PlatformScores {
  const platformScores: Partial<PlatformScores> = {};

  for (const id of LLM_PLATFORMS) {
    const weights = PLATFORM_WEIGHTS[id];
    const weightedScore =
      categories.technicalScore * weights.technical +
      categories.contentScore * weights.content +
      categories.aiReadinessScore * weights.ai_readiness +
      categories.performanceScore * weights.performance;

    const normalized = Math.max(0, Math.min(100, Math.round(weightedScore)));
    platformScores[id] = {
      score: normalized,
      grade: letterGrade(normalized),
      tips: PLATFORM_TIPS[id],
    };
  }

  return platformScores as PlatformScores;
}
