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
