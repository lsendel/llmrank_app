import { describe, it, expect } from "vitest";
import { aggregateIntegrations, type RawEnrichment } from "../integrations";

function makeEnrichment(
  overrides: Partial<RawEnrichment> & Pick<RawEnrichment, "provider">,
): RawEnrichment {
  return {
    data: {},
    ...overrides,
  };
}

describe("aggregateIntegrations", () => {
  // -------------------------------------------------------------------------
  // Null / empty cases
  // -------------------------------------------------------------------------

  it("returns null for empty enrichments array", () => {
    expect(aggregateIntegrations([])).toBeNull();
  });

  it("returns null when no matching providers exist", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({ provider: "psi", data: { score: 90 } }),
    ];
    expect(aggregateIntegrations(enrichments)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // GSC
  // -------------------------------------------------------------------------

  it("parses GSC data with queries array format", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: {
          queries: [
            {
              query: "best seo tools",
              impressions: 500,
              clicks: 30,
              position: 3.2,
            },
            {
              query: "ai seo checker",
              impressions: 200,
              clicks: 10,
              position: 5.5,
            },
          ],
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(2);
    expect(result!.gsc!.topQueries[0].query).toBe("best seo tools");
    expect(result!.gsc!.topQueries[0].impressions).toBe(500);
    expect(result!.gsc!.topQueries[0].clicks).toBe(30);
    expect(result!.gsc!.topQueries[0].position).toBe(3.2);
    expect(result!.gsc!.topQueries[1].query).toBe("ai seo checker");
  });

  it("parses GSC data with single-query format", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: {
          query: "llm boost review",
          impressions: 100,
          clicks: 5,
          position: 7,
        },
      }),
      makeEnrichment({
        provider: "gsc",
        data: {
          query: "ai readiness tool",
          impressions: 300,
          clicks: 20,
          position: 2,
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(2);
    // Sorted by impressions descending
    expect(result!.gsc!.topQueries[0].query).toBe("ai readiness tool");
    expect(result!.gsc!.topQueries[0].impressions).toBe(300);
    expect(result!.gsc!.topQueries[1].query).toBe("llm boost review");
  });

  it("deduplicates GSC queries by summing impressions/clicks and averaging positions", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: {
          queries: [
            { query: "seo tool", impressions: 100, clicks: 10, position: 4 },
          ],
        },
      }),
      makeEnrichment({
        provider: "gsc",
        data: {
          queries: [
            { query: "seo tool", impressions: 200, clicks: 15, position: 6 },
          ],
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(1);
    const q = result!.gsc!.topQueries[0];
    expect(q.query).toBe("seo tool");
    expect(q.impressions).toBe(300); // 100 + 200
    expect(q.clicks).toBe(25); // 10 + 15
    expect(q.position).toBe(5); // avg(4, 6) = 5
  });

  it("limits GSC to top 20 queries", () => {
    const queries = Array.from({ length: 30 }, (_, i) => ({
      query: `query-${i}`,
      impressions: 30 - i,
      clicks: 1,
      position: 1,
    }));
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: { queries },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(20);
    // First should be highest impressions
    expect(result!.gsc!.topQueries[0].query).toBe("query-0");
    expect(result!.gsc!.topQueries[0].impressions).toBe(30);
    // Last should be 20th highest
    expect(result!.gsc!.topQueries[19].query).toBe("query-19");
    expect(result!.gsc!.topQueries[19].impressions).toBe(11);
  });

  // -------------------------------------------------------------------------
  // GA4
  // -------------------------------------------------------------------------

  it("parses GA4 data with page-level format", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "ga4",
        data: {
          bounceRate: 45,
          avgEngagement: 120,
          url: "/home",
          sessions: 500,
        },
      }),
      makeEnrichment({
        provider: "ga4",
        data: {
          bounceRate: 55,
          avgEngagement: 80,
          url: "/about",
          sessions: 200,
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.ga4).not.toBeNull();
    expect(result!.ga4!.topPages).toHaveLength(2);
    expect(result!.ga4!.topPages[0]).toEqual({ url: "/home", sessions: 500 });
    expect(result!.ga4!.topPages[1]).toEqual({ url: "/about", sessions: 200 });
  });

  it("parses GA4 data with pages array format", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "ga4",
        data: {
          bounceRate: 40,
          avgEngagement: 100,
          pages: [
            { url: "/blog", sessions: 300 },
            { url: "/pricing", sessions: 150 },
          ],
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.ga4!.topPages).toHaveLength(2);
    expect(result!.ga4!.topPages[0]).toEqual({ url: "/blog", sessions: 300 });
    expect(result!.ga4!.topPages[1]).toEqual({
      url: "/pricing",
      sessions: 150,
    });
  });

  it("averages GA4 bounce rate and engagement across enrichments", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "ga4",
        data: { bounceRate: 40, avgEngagement: 100 },
      }),
      makeEnrichment({
        provider: "ga4",
        data: { bounceRate: 60, avgEngagement: 200 },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.ga4!.bounceRate).toBe(50); // avg(40, 60)
    expect(result!.ga4!.avgEngagement).toBe(150); // avg(100, 200)
  });

  // -------------------------------------------------------------------------
  // Clarity
  // -------------------------------------------------------------------------

  it("parses Clarity data with UX scores and rage clicks", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "clarity",
        data: {
          uxScore: 75,
          rageClicks: ["/checkout", "/signup"],
        },
      }),
      makeEnrichment({
        provider: "clarity",
        data: {
          uxScore: 85,
          rageClickUrl: "/pricing",
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.clarity).not.toBeNull();
    expect(result!.clarity!.avgUxScore).toBe(80); // avg(75, 85)
    expect(result!.clarity!.rageClickPages).toContain("/checkout");
    expect(result!.clarity!.rageClickPages).toContain("/signup");
    expect(result!.clarity!.rageClickPages).toContain("/pricing");
    expect(result!.clarity!.rageClickPages).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Partial data
  // -------------------------------------------------------------------------

  it("returns partial data when only GSC is present", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: {
          queries: [{ query: "test", impressions: 10, clicks: 1, position: 5 }],
        },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc).not.toBeNull();
    expect(result!.ga4).toBeNull();
    expect(result!.clarity).toBeNull();
  });

  it("returns partial data when only GA4 is present", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "ga4",
        data: { bounceRate: 50, avgEngagement: 90 },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc).toBeNull();
    expect(result!.ga4).not.toBeNull();
    expect(result!.clarity).toBeNull();
  });

  it("returns partial data when only Clarity is present", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "clarity",
        data: { uxScore: 70 },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc).toBeNull();
    expect(result!.ga4).toBeNull();
    expect(result!.clarity).not.toBeNull();
    expect(result!.clarity!.avgUxScore).toBe(70);
    expect(result!.clarity!.rageClickPages).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Malformed data
  // -------------------------------------------------------------------------

  it("handles malformed GSC data gracefully (missing fields)", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: { queries: [{ query: "test" }] }, // missing impressions/clicks/position
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(1);
    expect(result!.gsc!.topQueries[0]).toEqual({
      query: "test",
      impressions: 0,
      clicks: 0,
      position: 0,
    });
  });

  it("handles malformed GA4 data gracefully (missing fields)", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "ga4",
        data: {}, // no bounceRate, avgEngagement, url, or pages
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.ga4!.bounceRate).toBe(0);
    expect(result!.ga4!.avgEngagement).toBe(0);
    expect(result!.ga4!.topPages).toHaveLength(0);
  });

  it("handles malformed Clarity data gracefully (missing fields)", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "clarity",
        data: {}, // no uxScore or rageClicks
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.clarity!.avgUxScore).toBe(0);
    expect(result!.clarity!.rageClickPages).toHaveLength(0);
  });

  it("handles GSC data with empty queries array", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: { queries: [] },
      }),
    ];
    // No queries extracted, so gsc remains null => all null => returns null
    expect(aggregateIntegrations(enrichments)).toBeNull();
  });

  it("handles mixed providers with all data present", () => {
    const enrichments: RawEnrichment[] = [
      makeEnrichment({
        provider: "gsc",
        data: {
          queries: [
            { query: "test query", impressions: 500, clicks: 30, position: 2 },
          ],
        },
      }),
      makeEnrichment({
        provider: "ga4",
        data: {
          bounceRate: 45,
          avgEngagement: 120,
          url: "/home",
          sessions: 800,
        },
      }),
      makeEnrichment({
        provider: "clarity",
        data: { uxScore: 82, rageClicks: ["/form"] },
      }),
      // PSI should be ignored
      makeEnrichment({
        provider: "psi",
        data: { score: 95 },
      }),
    ];
    const result = aggregateIntegrations(enrichments);
    expect(result).not.toBeNull();
    expect(result!.gsc).not.toBeNull();
    expect(result!.gsc!.topQueries).toHaveLength(1);
    expect(result!.ga4).not.toBeNull();
    expect(result!.ga4!.bounceRate).toBe(45);
    expect(result!.ga4!.topPages).toHaveLength(1);
    expect(result!.clarity).not.toBeNull();
    expect(result!.clarity!.avgUxScore).toBe(82);
    expect(result!.clarity!.rageClickPages).toEqual(["/form"]);
  });
});
