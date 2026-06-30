import { describe, it, expect } from "vitest";
import {
  buildVisibilityGapRecommendation,
  buildVisibilityGapActions,
  type VisibilityQueryGap,
  type VisibilityGapOpportunity,
} from "../../utils/visibility-gap-actions";

const opp = (
  overrides: Partial<VisibilityGapOpportunity> = {},
): VisibilityGapOpportunity => ({
  domain: overrides.domain ?? "rivalcrm.com",
  mentionCount: overrides.mentionCount ?? 2,
  queries: overrides.queries ?? ["best crm tools", "crm for startups"],
});

describe("buildVisibilityGapActions (portfolio)", () => {
  it("names the competitor and sample queries, and is re-verifiable", () => {
    const [action] = buildVisibilityGapActions([opp()]);
    expect(action.title).toContain("rivalcrm.com");
    expect(action.description).toContain('"best crm tools"');
    expect(action.description).toContain("2 queries");
    expect(action.action).toBe("run_visibility_check");
    expect(action.category).toBe("visibility");
  });

  it("ranks by mention count and flags high priority at >=3", () => {
    const actions = buildVisibilityGapActions([
      opp({ domain: "low.com", mentionCount: 1 }),
      opp({ domain: "high.com", mentionCount: 5 }),
    ]);
    expect(actions[0].title).toContain("high.com");
    expect(actions[0].priority).toBe("high");
    expect(actions[1].priority).toBe("medium");
  });

  it("caps to the limit and skips malformed opportunities", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      opp({ domain: `c${i}.com`, mentionCount: 6 - i }),
    );
    expect(buildVisibilityGapActions(many, 2)).toHaveLength(2);
    expect(
      buildVisibilityGapActions([
        opp({ domain: "", mentionCount: 3 }),
        opp({ mentionCount: 0 }),
        opp({ queries: [] }),
      ]),
    ).toHaveLength(0);
  });

  it("singularizes a single-query gap", () => {
    const [action] = buildVisibilityGapActions([
      opp({ queries: ["best crm tools"] }),
    ]);
    expect(action.description).toContain("1 query");
  });
});

const gap = (
  overrides: Partial<VisibilityQueryGap> = {},
): VisibilityQueryGap => ({
  query: overrides.query ?? "best crm tools",
  competitorsCited: overrides.competitorsCited ?? [
    { domain: "rivalcrm.com" },
    { domain: "othercrm.com" },
  ],
});

describe("buildVisibilityGapRecommendation", () => {
  it("names the exact query and the competitors cited for it (page-specific)", () => {
    const rec = buildVisibilityGapRecommendation(gap());
    expect(rec.title).toBe('Invisible for "best crm tools"');
    expect(rec.description).toContain("rivalcrm.com, othercrm.com");
    expect(rec.description).toContain('"best crm tools"');
  });

  it("is re-verifiable — points at re-running the check for that query", () => {
    const rec = buildVisibilityGapRecommendation(gap());
    expect(rec.description).toContain(
      're-run the visibility check for "best crm tools"',
    );
  });

  it("uses singular grammar for a single competitor", () => {
    const rec = buildVisibilityGapRecommendation(
      gap({ competitorsCited: [{ domain: "rivalcrm.com" }] }),
    );
    expect(rec.description).toContain("rivalcrm.com is cited");
  });

  it("summarizes when more than three competitors are cited", () => {
    const rec = buildVisibilityGapRecommendation(
      gap({
        competitorsCited: [
          { domain: "a.com" },
          { domain: "b.com" },
          { domain: "c.com" },
          { domain: "d.com" },
          { domain: "e.com" },
        ],
      }),
    );
    expect(rec.description).toContain("a.com, b.com, c.com and 2 more");
  });

  it("handles a gap with no named competitors", () => {
    const rec = buildVisibilityGapRecommendation(gap({ competitorsCited: [] }));
    expect(rec.description).toContain("isn't cited in AI answers");
    expect(rec.description).toContain("re-run the visibility check");
  });
});
