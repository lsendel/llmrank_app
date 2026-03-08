import {
  buildIntegrationDeltaMetrics,
  buildPageUrlLookup,
  buildSignalTaskPlan,
  formatDeltaNumber,
  isNonIndexedStatus,
  planAllows,
  resolvePageIdForSignalUrl,
  truncateUrlPath,
} from "./integrations-tab-helpers";
import type { IntegrationInsights } from "@/lib/api";

describe("integrations-tab helpers", () => {
  it("enforces plan ordering for gated integrations", () => {
    expect(planAllows("pro", "pro")).toBe(true);
    expect(planAllows("agency", "pro")).toBe(true);
    expect(planAllows("starter", "pro")).toBe(false);
  });

  it("builds URL lookup keys and falls back from full URL to path", () => {
    const lookup = buildPageUrlLookup([
      { id: "page-home", url: "https://example.com/" },
      { id: "page-blog", url: "https://example.com/blog/post/" },
    ] as never[]);

    expect(
      resolvePageIdForSignalUrl("https://example.com/blog/post", lookup),
    ).toBe("page-blog");
    expect(
      resolvePageIdForSignalUrl("https://another-site.com/blog/post", lookup),
    ).toBe("page-blog");
    expect(resolvePageIdForSignalUrl("not-a-url", lookup)).toBeNull();
  });

  it("detects non-indexed statuses using common GSC wording", () => {
    expect(isNonIndexedStatus("Blocked by robots.txt")).toBe(true);
    expect(isNonIndexedStatus('Excluded by "noindex" tag')).toBe(true);
    expect(isNonIndexedStatus("Indexed")).toBe(false);
  });

  it("formats delta values with direction and suffix handling", () => {
    expect(formatDeltaNumber(72.4, 70.1, { decimals: 1, suffix: "%" })).toEqual(
      {
        currentValue: "72.4%",
        deltaValue: "+2.3%",
        direction: "positive",
      },
    );

    expect(
      formatDeltaNumber(68.2, 70.1, {
        decimals: 1,
        suffix: "%",
        higherIsBetter: false,
      }),
    ).toEqual({
      currentValue: "68.2%",
      deltaValue: "-1.9%",
      direction: "positive",
    });

    expect(formatDeltaNumber(10, 10)).toEqual({
      currentValue: "10",
      deltaValue: "0",
      direction: "neutral",
    });
  });

  it("truncates long parsed URL paths", () => {
    expect(
      truncateUrlPath(
        "https://example.com/this/is/a/very/long/url/path/that/should/be/truncated",
      ),
    ).toBe("/this/is/a/very/long/url/path/that/shou...");
    expect(truncateUrlPath("invalid-url")).toBe("invalid-url");
  });

  it("builds delta metrics from overlapping integration snapshots", () => {
    const metrics = buildIntegrationDeltaMetrics(
      {
        crawlId: "crawl-2",
        integrations: {
          gsc: {
            totalClicks: 120,
            indexedPages: [
              { status: "Indexed" },
              { status: "Blocked by robots.txt" },
            ],
          },
          ga4: { bounceRate: 68.2 },
          clarity: { avgUxScore: 82.5 },
          meta: { totalShares: 4, totalReactions: 3, totalComments: 2 },
        },
      } as IntegrationInsights,
      {
        crawlId: "crawl-1",
        integrations: {
          gsc: {
            totalClicks: 100,
            indexedPages: [{ status: "Indexed" }, { status: "Indexed" }],
          },
          ga4: { bounceRate: 72.5 },
          clarity: { avgUxScore: 79.5 },
          meta: { totalShares: 2, totalReactions: 2, totalComments: 1 },
        },
      } as IntegrationInsights,
    );

    expect(metrics).toEqual([
      {
        id: "gsc-clicks",
        label: "GSC Clicks",
        currentValue: "120",
        deltaValue: "+20",
        direction: "positive",
      },
      {
        id: "gsc-non-indexed",
        label: "Non-indexed pages",
        currentValue: "1",
        deltaValue: "+1",
        direction: "negative",
      },
      {
        id: "ga4-bounce",
        label: "GA4 bounce rate",
        currentValue: "68.2%",
        deltaValue: "-4.3%",
        direction: "positive",
      },
      {
        id: "clarity-ux",
        label: "Clarity UX score",
        currentValue: "82.5",
        deltaValue: "+3.0",
        direction: "positive",
      },
      {
        id: "meta-engagement",
        label: "Meta engagement",
        currentValue: "9",
        deltaValue: "+4",
        direction: "positive",
      },
    ]);
  });

  it("builds signal task plans from GSC, Clarity, and GA4 anomalies", () => {
    const pageLookup = buildPageUrlLookup([
      { id: "page-index", url: "https://example.com/index-me" },
      { id: "page-rage", url: "https://example.com/rage-clicks" },
    ] as never[]);

    const plan = buildSignalTaskPlan({
      integrationInsights: {
        crawlId: "crawl-2",
        integrations: {
          gsc: {
            indexedPages: [
              {
                url: "https://example.com/index-me",
                status: "Blocked by robots.txt",
              },
              {
                url: "https://example.com/missing-page",
                status: 'Excluded by "noindex" tag',
              },
            ],
          },
          clarity: {
            rageClickPages: ["https://example.com/rage-clicks"],
          },
          ga4: {
            bounceRate: 70,
            avgEngagement: 42,
          },
        },
      } as IntegrationInsights,
      pageUrlLookup: pageLookup,
      currentUserId: "user-1",
    });

    expect(plan.reasons).toEqual([
      "2 pages are not indexed in Google.",
      "1 page have rage-click events in Clarity.",
      "GA4 bounce rate is 70.0%, above the 65% review threshold.",
    ]);
    expect(plan.items).toHaveLength(4);
    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageId: "page-index",
          issueCode: "INTEGRATION_GSC_NOT_INDEXED",
          assigneeId: "user-1",
        }),
        expect.objectContaining({
          issueCode: "INTEGRATION_GSC_NOT_INDEXED_UNMAPPED",
          description:
            "1 non-indexed page URL could not be mapped to crawl pages.",
        }),
        expect.objectContaining({
          pageId: "page-rage",
          issueCode: "INTEGRATION_CLARITY_RAGE_CLICKS",
        }),
        expect.objectContaining({
          issueCode: "INTEGRATION_GA4_HIGH_BOUNCE",
          title: "Reduce bounce rate on top landing pages",
        }),
      ]),
    );
    expect(plan.items.every((item) => item.dueAt)).toBe(true);
  });
});
