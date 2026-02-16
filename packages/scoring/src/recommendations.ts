import {
  ISSUE_DEFINITIONS,
  LLM_PLATFORMS,
  type Issue,
} from "@llm-boost/shared";
import type { LLMPlatformId } from "@llm-boost/shared";

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationEffort = "quick" | "moderate" | "significant";
export type RecommendationImpact = "high" | "medium" | "low";

export interface Recommendation {
  issueCode: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  effort: RecommendationEffort;
  impact: RecommendationImpact;
  estimatedImprovement: number;
  affectedPlatforms: LLMPlatformId[];
  steps?: string[];
  example?: { before: string; after: string };
}

export interface Strength {
  category: "technical" | "content" | "ai_readiness" | "performance";
  title: string;
  description: string;
}

interface RecommendationTemplate {
  title: string;
  description: string;
  priority: RecommendationPriority;
  effort: RecommendationEffort;
  impact: RecommendationImpact;
  estimatedImprovement: number;
  affectedPlatforms: LLMPlatformId[];
  steps?: string[];
  example?: { before: string; after: string };
}

const priorityFromSeverity: Record<string, RecommendationPriority> = {
  critical: "high",
  warning: "medium",
  info: "low",
};

const effortMap: Record<string, RecommendationEffort> = {
  low: "quick",
  medium: "moderate",
  high: "significant",
};

function impactFromScore(scoreImpact: number): RecommendationImpact {
  const impact = Math.abs(scoreImpact);
  if (impact >= 15) return "high";
  if (impact >= 8) return "medium";
  return "low";
}

function titleFromCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function templateFromDefinition(code: string): RecommendationTemplate {
  const def = ISSUE_DEFINITIONS[code];
  if (!def) {
    return {
      title: titleFromCode(code),
      description: "Address this issue to improve AI visibility.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: [...LLM_PLATFORMS],
    };
  }

  const steps = def.implementationSnippet
    ? ["Implement the following snippet:", def.implementationSnippet]
    : undefined;

  return {
    title: titleFromCode(code),
    description: def.recommendation,
    priority: priorityFromSeverity[def.severity] ?? "medium",
    effort: effortMap[def.effortLevel] ?? "moderate",
    impact: impactFromScore(def.scoreImpact),
    estimatedImprovement: Math.max(3, Math.min(20, Math.abs(def.scoreImpact))),
    affectedPlatforms: [...LLM_PLATFORMS],
    steps,
  };
}

export const RECOMMENDATION_TEMPLATES: Record<string, RecommendationTemplate> =
  Object.fromEntries(
    Object.keys(ISSUE_DEFINITIONS).map((code) => [
      code,
      templateFromDefinition(code),
    ]),
  );

const priorityRank: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const impactRank: Record<RecommendationImpact, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function generateRecommendations(
  issues: Issue[],
  overallScore: number,
  maxRecommendations = 10,
): Recommendation[] {
  if (!issues.length) return [];

  const issueByCode = new Map<string, Issue>();
  const severityRank: Record<string, number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };

  for (const issue of issues) {
    const existing = issueByCode.get(issue.code);
    if (!existing) {
      issueByCode.set(issue.code, issue);
      continue;
    }
    const incomingRank = severityRank[issue.severity] ?? 0;
    const currentRank = severityRank[existing.severity] ?? 0;
    if (incomingRank > currentRank) {
      issueByCode.set(issue.code, issue);
    }
  }

  const recommendations: Recommendation[] = [];
  for (const code of issueByCode.keys()) {
    const template =
      RECOMMENDATION_TEMPLATES[code] ?? templateFromDefinition(code);
    recommendations.push({
      issueCode: code,
      ...template,
      estimatedImprovement:
        template.estimatedImprovement + (overallScore < 60 ? 2 : 0),
    });
  }

  recommendations.sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    if (impactRank[a.impact] !== impactRank[b.impact]) {
      return impactRank[a.impact] - impactRank[b.impact];
    }
    return b.estimatedImprovement - a.estimatedImprovement;
  });

  return recommendations.slice(0, maxRecommendations);
}

const STRENGTH_TEMPLATES: Record<
  string,
  { title: string; description: string }
> = {
  technical: {
    title: "Technical foundation is solid",
    description:
      "Core SEO infrastructure (indexation, canonicals, metadata) is in great shape.",
  },
  content: {
    title: "Content depth and structure stand out",
    description:
      "Pages provide comprehensive coverage with clear hierarchy and supporting assets.",
  },
  aiReadiness: {
    title: "Optimized for AI discovery",
    description:
      "Structured data, crawler access, and llms.txt signals are configured well.",
  },
  performance: {
    title: "Fast, stable experience",
    description:
      "Lighthouse and Core Web Vitals indicators show consistently quick rendering.",
  },
};

export function generateStrengths(
  categoryScores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  },
  issues: Issue[],
  maxStrengths = 5,
): Strength[] {
  const criticalByCategory = new Set<string>();
  for (const issue of issues) {
    if (issue.severity === "critical") {
      criticalByCategory.add(issue.category);
    }
  }

  const strengths: Strength[] = [];
  const thresholds: Record<string, number> = {
    technical: 85,
    content: 88,
    aiReadiness: 85,
    performance: 80,
  };

  for (const [category, score] of Object.entries(categoryScores)) {
    if (criticalByCategory.has(category)) continue;
    const threshold = thresholds[category] ?? 85;
    if (score >= threshold) {
      const template = STRENGTH_TEMPLATES[category];
      strengths.push({
        category: category as Strength["category"],
        title: template.title,
        description: template.description,
      });
    }
  }

  return strengths.slice(0, maxStrengths);
}
