import { scorePage } from "../../engine";
import type { PageData } from "../../types";

/**
 * A single issue as captured in a golden snapshot. `scoreImpact` is the ACTUAL
 * signed deduction the factor applied (dynamic for tiered/LLM-scored factors),
 * which is exactly what a scoring change would move — so it is load-bearing.
 */
export interface IssueSnapshot {
  code: string;
  severity: string;
  category: string;
  scoreImpact: number | null;
}

/**
 * The deterministic, committed shape of a fixture's scoring output. Captures the
 * overall + category scores, the letter grade, the full issue set (codes,
 * severities, and applied deductions), and the per-platform scores.
 */
export interface FixtureSnapshot {
  overallScore: number;
  letterGrade: string;
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
  /** Sorted, de-duplicated issue codes — the quick-diff view. */
  issueCodes: string[];
  /** Full issue detail, sorted by code for a stable diff. */
  issues: IssueSnapshot[];
  /** Per-platform overall score, keyed by platform id (sorted). */
  platformScores: Record<string, number>;
}

/**
 * Run the CURRENT scoring engine over a page and normalize the result into a
 * deterministic snapshot object. Sorting everything by a stable key keeps the
 * committed JSON diff minimal and order-independent.
 */
export function scoreToSnapshot(page: PageData): FixtureSnapshot {
  const result = scorePage(page);

  const issues: IssueSnapshot[] = result.issues
    .map((i) => ({
      code: i.code,
      severity: i.severity,
      category: i.category,
      scoreImpact: i.scoreImpact ?? null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const issueCodes = Array.from(new Set(issues.map((i) => i.code))).sort();

  const platformScores: Record<string, number> = {};
  for (const id of Object.keys(result.platformScores).sort()) {
    platformScores[id] =
      result.platformScores[id as keyof typeof result.platformScores].score;
  }

  return {
    overallScore: result.overallScore,
    letterGrade: result.letterGrade,
    technicalScore: result.technicalScore,
    contentScore: result.contentScore,
    aiReadinessScore: result.aiReadinessScore,
    performanceScore: result.performanceScore,
    issueCodes,
    issues,
    platformScores,
  };
}
