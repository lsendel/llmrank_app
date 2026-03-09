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

  it("normalizes urls and indexed status checks", () => {
    expect(stripUrlOrigin("https://example.com/pricing")).toBe("/pricing");
    expect(isIndexedStatus("Indexed, not submitted in sitemap")).toBe(true);
    expect(isIndexedStatus("Discovered - currently not indexed")).toBe(true);
    expect(isIndexedStatus("Crawled - currently not available")).toBe(false);
  });
});
