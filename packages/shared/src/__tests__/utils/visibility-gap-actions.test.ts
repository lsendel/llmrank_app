import { describe, it, expect } from "vitest";
import {
  buildVisibilityGapRecommendation,
  type VisibilityQueryGap,
} from "../../utils/visibility-gap-actions";

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
