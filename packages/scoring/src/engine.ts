import type { PageData, ScoringResult } from "./types";
import { scoreTechnicalFactors } from "./factors/technical";
import { scoreContentFactors } from "./factors/content";
import { scoreAiReadinessFactors } from "./factors/ai-readiness";
import { scorePerformanceFactors } from "./factors/performance";
import type { Issue } from "@llm-boost/shared";

const WEIGHTS = {
  technical: 0.25,
  content: 0.3,
  ai_readiness: 0.3,
  performance: 0.15,
};

function getLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scorePage(page: PageData): ScoringResult {
  // Special case: 4xx/5xx pages get 0
  if (page.statusCode >= 400) {
    return {
      overallScore: 0,
      technicalScore: 0,
      contentScore: 0,
      aiReadinessScore: 0,
      performanceScore: 0,
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

  const technical = scoreTechnicalFactors(page);
  const content = scoreContentFactors(page);
  const aiReadiness = scoreAiReadinessFactors(page);
  const performance = scorePerformanceFactors(page);

  const overallScore = Math.round(
    technical.score * WEIGHTS.technical +
      content.score * WEIGHTS.content +
      aiReadiness.score * WEIGHTS.ai_readiness +
      performance.score * WEIGHTS.performance,
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
    issues: allIssues,
  };
}
