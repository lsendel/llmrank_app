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
  performanceMeasured = true,
): PlatformScores {
  const platformScores: Partial<PlatformScores> = {};

  for (const id of LLM_PLATFORMS) {
    const weights = PLATFORM_WEIGHTS[id];

    // Mirror the engine: when performance wasn't measured, drop its weight and
    // renormalize the measured categories per-platform so an unmeasured page
    // isn't credited a fabricated 100 on whatever weight this platform assigns
    // to performance (up to 0.25 for Copilot/Grok).
    let wTech = weights.technical;
    let wContent = weights.content;
    let wAi = weights.ai_readiness;
    let wPerf = weights.performance;
    if (!performanceMeasured) {
      const measuredSum = wTech + wContent + wAi;
      if (measuredSum > 0) {
        wTech /= measuredSum;
        wContent /= measuredSum;
        wAi /= measuredSum;
      }
      wPerf = 0;
    }

    const weightedScore =
      categories.technicalScore * wTech +
      categories.contentScore * wContent +
      categories.aiReadinessScore * wAi +
      categories.performanceScore * wPerf;

    const normalized = Math.max(0, Math.min(100, Math.round(weightedScore)));
    platformScores[id] = {
      score: normalized,
      grade: letterGrade(normalized),
      tips: PLATFORM_TIPS[id],
    };
  }

  return platformScores as PlatformScores;
}
