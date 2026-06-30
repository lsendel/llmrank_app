/**
 * A query where the user's brand is NOT cited in AI answers but one or more
 * competitors are — the gap shape the visibility recommendations endpoint
 * computes from `visibility_checks`.
 */
export interface VisibilityQueryGap {
  query: string;
  competitorsCited: Array<{ domain: string }>;
}

/**
 * Turn a measured visibility gap into a page-specific, re-verifiable
 * recommendation — closing the loop between the visibility checks we run and the
 * recommendations we surface. Names the exact query and the competitors cited
 * for it, and points the user at re-running the visibility check for THAT query
 * to confirm the fix landed (instead of the old generic "create targeted
 * content" string).
 *
 * Pure: no DB/IO.
 */
export function buildVisibilityGapRecommendation(gap: VisibilityQueryGap): {
  title: string;
  description: string;
} {
  const domains = gap.competitorsCited.map((c) => c.domain).filter(Boolean);
  const shown = domains.slice(0, 3).join(", ");
  const more = domains.length > 3 ? ` and ${domains.length - 3} more` : "";
  const verb = domains.length === 1 ? "is" : "are";
  const competitorClause = domains.length
    ? `${shown}${more} ${verb} cited in AI answers for "${gap.query}" but your brand isn't.`
    : `Your brand isn't cited in AI answers for "${gap.query}".`;
  return {
    title: `Invisible for "${gap.query}"`,
    description:
      `${competitorClause} Publish authoritative, citable content answering ` +
      `this query, then re-run the visibility check for "${gap.query}" to ` +
      `confirm you're now cited.`,
  };
}

/**
 * A competitor domain surfaced in AI answers across queries where the brand is
 * absent — the domain-centric shape `getSourceOpportunities` returns.
 */
export interface VisibilityGapOpportunity {
  domain: string;
  mentionCount: number;
  queries: string[];
}

/** A portfolio "Next Best Action" derived from a measured visibility gap. */
export interface VisibilityGapAction {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  action?: string;
}

/**
 * Turn measured visibility gaps (a competitor cited across queries where the
 * brand is absent) into portfolio Next Best Actions — page-specific (names the
 * competitor + the queries) and re-verifiable (re-run the check). Sorted by
 * mention count, capped. Pure: no DB/IO.
 */
export function buildVisibilityGapActions(
  opportunities: VisibilityGapOpportunity[],
  limit = 3,
): VisibilityGapAction[] {
  return opportunities
    .filter((o) => o.domain && o.mentionCount > 0 && o.queries.length > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, Math.max(0, limit))
    .map((o) => {
      const queryCount = o.queries.length;
      const noun = queryCount === 1 ? "query" : "queries";
      const sample = o.queries
        .slice(0, 2)
        .map((q) => `"${q}"`)
        .join(", ");
      return {
        priority: o.mentionCount >= 3 ? "high" : "medium",
        category: "visibility",
        title: `${o.domain} is cited where you're invisible`,
        description:
          `${o.domain} appears in AI answers for ${queryCount} ${noun} ` +
          `where your brand isn't mentioned (e.g. ${sample}). Publish ` +
          `authoritative content targeting these queries, then re-run the ` +
          `visibility check to confirm you're now cited.`,
        action: "run_visibility_check",
      };
    });
}
