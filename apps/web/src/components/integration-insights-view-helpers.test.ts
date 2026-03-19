import { describe, expect, it } from "vitest";
import {
  buildSummaryItems,
  isIndexedStatus,
  stripUrlOrigin,
} from "./integration-insights-view-helpers";

describe("integration insights view helpers", () => {
  it("builds summary items from connected integrations", () => {
    const items = buildSummaryItems({
      gsc: {
        topQueries: [
          { query: "llm rank", impressions: 100, clicks: 20, position: 4.2 },
        ],
        totalClicks: 20,
        totalImpressions: 100,
        indexedPages: [
          { url: "https://example.com/", status: "Submitted and indexed" },
        ],
      },
      ga4: {
        bounceRate: 42.5,
        avgEngagement: 93.2,
        topPages: [],
      },
      clarity: {
        avgUxScore: 77.2,
        rageClickPages: ["/pricing", "/contact"],
      },
      meta: {
        totalShares: 120,
        totalReactions: 40,
        totalComments: 10,
        topSocialPages: [],
        adSummary: null,
        topAdPages: null,
      },
    });

    expect(items.map((item) => item.label)).toEqual([
      "GSC",
      "GA4",
      "Clarity",
      "Meta",
    ]);
    expect(items[0]?.value).toContain("1 queries tracked");
    expect(items[1]?.value).toContain("93s avg engagement");
    expect(items[2]?.value).toContain("2 rage click pages");
    expect(items[3]?.value).toContain("170 social engagements");
  });

  it("shows pages tracked and non-indexed count in GSC summary when no queries", () => {
    const items = buildSummaryItems({
      gsc: {
        topQueries: [],
        totalClicks: 0,
        totalImpressions: 0,
        indexedPages: [
          { url: "https://example.com/", status: "Submitted and indexed" },
          {
            url: "https://example.com/about",
            status: "Discovered - currently not indexed",
          },
          {
            url: "https://example.com/blog",
            status: "Crawled - currently not available",
          },
        ],
      },
    });

    expect(items[0]?.label).toBe("GSC");
    expect(items[0]?.value).toBe("3 pages tracked · 2 not indexed");
  });

  it("shows 'No index data yet' in GSC summary when no pages tracked", () => {
    const items = buildSummaryItems({
      gsc: {
        topQueries: [],
        totalClicks: 0,
        totalImpressions: 0,
        indexedPages: [],
      },
    });

    expect(items[0]?.label).toBe("GSC");
    expect(items[0]?.value).toBe("No index data yet");
  });

  it("shows 'No sessions recorded yet' in GA4 summary when all values are zero", () => {
    const items = buildSummaryItems({
      ga4: {
        bounceRate: 0,
        avgEngagement: 0,
        topPages: [],
      },
    });

    expect(items[0]?.label).toBe("GA4");
    expect(items[0]?.value).toBe("No sessions recorded yet");
  });

  it("shows 'No sessions recorded yet' in Clarity summary when all values are zero", () => {
    const items = buildSummaryItems({
      clarity: {
        avgUxScore: 0,
        rageClickPages: [],
      },
    });

    expect(items[0]?.label).toBe("Clarity");
    expect(items[0]?.value).toBe("No sessions recorded yet");
  });

  it("normalizes urls and indexed status checks", () => {
    expect(stripUrlOrigin("https://example.com/pricing")).toBe("/pricing");
    expect(isIndexedStatus("Indexed, not submitted in sitemap")).toBe(true);
    expect(isIndexedStatus("Discovered - currently not indexed")).toBe(true);
    expect(isIndexedStatus("Crawled - currently not available")).toBe(false);
  });
});
