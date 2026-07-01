import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * Performance-signal fixtures (measured vs unmeasured) and the 4xx/5xx
 * short-circuit error pages.
 */
export const performanceAndErrorFixtures: GoldenFixture[] = [
  makeFixture(
    "bulk-crawl-no-lighthouse",
    "A bulk-crawl page with NO Lighthouse and no page-weight signal → " +
      "performance is UNMEASURED. The engine must drop performance's weight and " +
      "renormalize the measured categories rather than credit a fabricated 100. " +
      "Carries a small THIN_CONTENT (-8, 400 words) so the renormalization is " +
      "observable in the overall score.",
    ["generic-seo", "edge"],
    {
      page: {
        wordCount: 400,
        contentHash: "bulk-no-lh-hash",
        lighthouse: null,
      },
    },
  ),

  makeFixture(
    "large-slow-page",
    "No Lighthouse, but a measured page weight (4 MB) and a slow response " +
      "(3 s). Should flag LARGE_PAGE_SIZE (performance, measured via page weight) " +
      "and SLOW_RESPONSE (technical).",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "large-slow-hash", lighthouse: null },
      siteContext: {
        pageSizeBytes: 4 * 1024 * 1024,
        responseTimeMs: 3000,
      },
    },
  ),

  makeFixture(
    "http-404",
    "A 404 page. The engine short-circuits: all scores 0, a single HTTP_STATUS " +
      "issue, grade F.",
    ["generic-seo", "error"],
    { page: { statusCode: 404, contentHash: "http-404-hash" } },
  ),

  makeFixture(
    "http-500",
    "A 500 page. Same short-circuit as 404: all scores 0, HTTP_STATUS, grade F.",
    ["generic-seo", "error"],
    { page: { statusCode: 500, contentHash: "http-500-hash" } },
  ),
];
