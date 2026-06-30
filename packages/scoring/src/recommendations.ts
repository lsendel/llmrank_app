import {
  ISSUE_DEFINITIONS,
  LLM_PLATFORMS,
  type Issue,
} from "@llm-boost/shared";
import type { LLMPlatformId } from "@llm-boost/shared";
import { DEFAULT_WEIGHTS, normalizeWeights } from "./profiles";

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

// Category weights normalized to sum to 1.0 (technical .25 / content .30 /
// ai_readiness .30 / performance .15). Keyed by IssueCategory.
const CATEGORY_WEIGHTS = normalizeWeights(DEFAULT_WEIGHTS);

/**
 * Headline-score points a customer regains by fixing this issue. A factor
 * deducts *within its category*, and each category contributes to the overall
 * score by its weight, so the true headline lift is |applied deduction| ×
 * category weight — not the raw category deduction. Prefers the per-instance
 * applied amount (issue.scoreImpact) over the definition's nominal value, since
 * tiered/LLM-scored factors carry a nominal scoreImpact of 0. Floored at 1 so a
 * real issue never reads "+0 points".
 */
function predictedLift(issue: Issue): number {
  const def = ISSUE_DEFINITIONS[issue.code];
  const weight = def
    ? CATEGORY_WEIGHTS[def.category]
    : CATEGORY_WEIGHTS.content;
  const applied =
    typeof issue.scoreImpact === "number" && issue.scoreImpact !== 0
      ? issue.scoreImpact
      : (def?.scoreImpact ?? 0);
  const impact = Math.abs(applied) || 5;
  return Math.max(1, Math.round(impact * weight));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a concise specifics clause from an issue's `data` payload so the
 * recommendation names the exact thing to fix (the 12 images missing alt text,
 * the HTTP 503, the blocked crawler) instead of a generic template. Returns
 * null when the data has no recognised, presentable detail — callers append
 * nothing rather than dumping raw JSON.
 */
function describeIssueData(
  code: string,
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const list = (v: unknown): string[] | null =>
    Array.isArray(v) && v.length > 0 ? v.map(String) : null;
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const join = (items: string[], max = 5) =>
    items.length > max
      ? `${items.slice(0, max).join(", ")} (+${items.length - max} more)`
      : items.join(", ");

  switch (code) {
    case "MISSING_ALT_TEXT": {
      const n = num(data.imagesWithoutAlt);
      return n
        ? `${count(n, "image is", "images are")} missing alt text.`
        : null;
    }
    case "THIN_CONTENT": {
      const n = num(data.wordCount);
      return n != null ? `This page has ${count(n, "word", "words")}.` : null;
    }
    case "MULTIPLE_H1": {
      const n = num(data.h1Count);
      return n
        ? `Found ${count(n, "H1 tag", "H1 tags")} (there should be exactly one).`
        : null;
    }
    case "HEADING_HIERARCHY": {
      const { skippedFrom, skippedTo } = data;
      return skippedFrom && skippedTo
        ? `Headings jump from ${skippedFrom} to ${skippedTo}, skipping a level.`
        : null;
    }
    case "HTTP_STATUS":
    case "HTTP_GONE": {
      const n = num(data.statusCode);
      return n ? `The page returns HTTP ${n}.` : null;
    }
    case "SLOW_RESPONSE": {
      const n = num(data.responseTimeMs);
      return n ? `The server took ${n}ms to respond.` : null;
    }
    case "LARGE_PAGE_SIZE": {
      const n = num(data.pageSizeMB);
      return n ? `This page weighs about ${n}MB.` : null;
    }
    case "HREFLANG_INVALID": {
      const items = list(data.invalid);
      return items
        ? `Invalid hreflang ${items.length === 1 ? "code" : "codes"}: ${join(items)}.`
        : null;
    }
    case "AI_CRAWLER_BLOCKED": {
      const items = list(data.blockedCrawlers);
      return items
        ? `Blocked AI ${items.length === 1 ? "crawler" : "crawlers"}: ${join(items)}.`
        : null;
    }
    case "INCOMPLETE_SCHEMA": {
      const type = typeof data.schemaType === "string" ? data.schemaType : null;
      const props = list(data.missingProps);
      if (type && props) return `${type} schema is missing: ${join(props)}.`;
      if (props) return `Schema is missing: ${join(props)}.`;
      return null;
    }
    default:
      return null;
  }
}

/**
 * True when the description already surfaces the issue's data values (e.g. a
 * factor's custom recommendation that already mentions the word count), so we
 * don't append a redundant specifics clause.
 */
function dataValueAlreadyShown(
  description: string,
  data: Record<string, unknown> | undefined,
): boolean {
  if (!data) return false;
  return Object.values(data).some((v) => {
    if (typeof v !== "number" && typeof v !== "string") return false;
    const token = String(v);
    if (!token) return false;
    // Word-boundary match so "8" matches "8 words" but not "v8" or "808".
    return new RegExp(`(?<![\\w.])${escapeRegExp(token)}(?![\\w.])`).test(
      description,
    );
  });
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

  // A single fix can't add back more than the page is currently missing.
  const headroom = Math.max(0, 100 - overallScore);
  const recommendations: Recommendation[] = [];
  for (const issue of issueByCode.values()) {
    const code = issue.code;
    const def = ISSUE_DEFINITIONS[code];
    const template =
      RECOMMENDATION_TEMPLATES[code] ?? templateFromDefinition(code);
    // Prefer the factor's per-instance recommendation (often customised with
    // this page's real numbers) over the static template, then append a
    // specifics clause from issue.data so the report names the exact fix.
    let description = issue.recommendation?.trim() || template.description;
    // Only a *customised* recommendation can already contain the data (e.g.
    // THIN_CONTENT bakes in the word count). A generic template never does — so
    // don't let its example text (e.g. "H1 > H2 > H3") suppress the specifics.
    const usesCustomRecommendation =
      !!def && issue.recommendation?.trim() !== def.recommendation;
    const specifics = describeIssueData(code, issue.data);
    if (
      specifics &&
      !(
        usesCustomRecommendation &&
        dataValueAlreadyShown(description, issue.data)
      )
    ) {
      description = `${description} ${specifics}`;
    }
    const lift = predictedLift(issue);
    recommendations.push({
      issueCode: code,
      ...template,
      description,
      estimatedImprovement: Math.min(lift, headroom || lift),
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
