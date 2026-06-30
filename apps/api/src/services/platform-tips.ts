import {
  PLATFORM_WEIGHTS,
  ISSUE_DEFINITIONS,
  type LLMPlatformId,
  type PlatformCategoryWeights,
} from "@llm-boost/shared";

/** The minimal slice of an issue definition this module needs. */
export interface TipIssueDefinition {
  category: keyof PlatformCategoryWeights;
  severity: "critical" | "warning" | "info";
  scoreImpact: number;
  recommendation: string;
}

/** A project's issue rolled up by code, with the number of pages it affects. */
export interface AggregatedIssue {
  code: string;
  count: number;
}

// Severity is already embedded in |scoreImpact| (a critical issue deducts more
// than an info one), so it is used only as a deterministic tiebreaker rather
// than as a second multiplier that would double-count it.
const SEVERITY_RANK: Record<TipIssueDefinition["severity"], number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export interface DerivePlatformTipsOptions {
  limit?: number;
  /** Override the issue catalog (defaults to ISSUE_DEFINITIONS); for testing. */
  definitions?: Record<string, TipIssueDefinition>;
}

/**
 * Data-driven per-provider recommendations.
 *
 * Each provider weights the four scoring categories differently
 * (PLATFORM_WEIGHTS) — e.g. ChatGPT leans on ai_readiness (.5) + content (.3),
 * Copilot on technical (.35) + performance (.25). For a given project's ACTUAL
 * issues (grouped by code with affected-page counts) we surface the issues that
 * matter most to THAT provider:
 *
 *     impact = |scoreImpact| × affectedPages × providerWeight[issue.category]
 *
 * |scoreImpact| is the severity-graded magnitude from ISSUE_DEFINITIONS, so a
 * critical issue outranks an info one; multiplying by the provider's weight for
 * the issue's category makes a technical issue surface for Copilot but rank low
 * for ChatGPT. Ties break by severity then code, so output is deterministic.
 *
 * Returns each issue's canonical `recommendation` copy (no invented text), top
 * `limit` (default 3). Returns [] when the project has no issues that map to a
 * known definition — the caller then falls back to the static PLATFORM_TIPS so
 * a clean or empty crawl never regresses.
 */
export function derivePlatformTips(
  platform: LLMPlatformId,
  issues: AggregatedIssue[],
  options: DerivePlatformTipsOptions = {},
): string[] {
  const limit = options.limit ?? 3;
  const definitions =
    options.definitions ??
    (ISSUE_DEFINITIONS as Record<string, TipIssueDefinition>);
  const weights = PLATFORM_WEIGHTS[platform];
  if (!weights) return [];

  const ranked = issues
    .map(({ code, count }) => {
      const def = definitions[code];
      if (!def || count <= 0) return null;
      const weight = weights[def.category] ?? 0;
      const magnitude = Math.abs(def.scoreImpact);
      return {
        code,
        recommendation: def.recommendation,
        impact: magnitude * count * weight,
        severityRank: SEVERITY_RANK[def.severity] ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.impact > 0)
    .sort(
      (a, b) =>
        b.impact - a.impact ||
        b.severityRank - a.severityRank ||
        a.code.localeCompare(b.code),
    );

  // Dedupe identical recommendation copy while preserving impact order.
  const seen = new Set<string>();
  const tips: string[] = [];
  for (const r of ranked) {
    if (seen.has(r.recommendation)) continue;
    seen.add(r.recommendation);
    tips.push(r.recommendation);
    if (tips.length >= limit) break;
  }
  return tips;
}
