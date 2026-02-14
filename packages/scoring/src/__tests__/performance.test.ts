import { describe, it, expect } from "vitest";
import { scorePerformanceFactors } from "../factors/performance";
import type { PageData } from "../types";

function makePageData(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here",
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Main Heading"],
      h2: ["Section 1", "Section 2"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage"],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://external.com"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "/img.png",
      },
      structured_data: [{ "@type": "WebPage" }],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 20,
      top_transition_words: ["however", "therefore"],
    },
    lighthouse: {
      performance: 0.9,
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    },
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
    ...overrides,
  };
}

describe("Performance Factors", () => {
  it("passes all checks for a well-performing page", () => {
    const result = scorePerformanceFactors(makePageData());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- LH_PERF_LOW ---

  it("LH_PERF_LOW: deducts 20 for performance < 0.5", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.3,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(80);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_PERF_LOW" }),
    );
  });

  it("LH_PERF_LOW: deducts 10 for performance between 0.5 and 0.79", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.65,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_PERF_LOW" }),
    );
  });

  it("LH_PERF_LOW: no deduction for performance >= 0.8", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.8,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    const issue = result.issues.find((i) => i.code === "LH_PERF_LOW");
    expect(issue).toBeUndefined();
  });

  it("LH_PERF_LOW: deducts 10 for performance exactly 0.5", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.5,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(90);
  });

  it("LH_PERF_LOW: deducts 20 for performance exactly 0.49", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.49,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(80);
  });

  // --- LH_SEO_LOW ---

  it("LH_SEO_LOW: deducts 15 for SEO < 0.8", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.6,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_SEO_LOW" }),
    );
  });

  it("LH_SEO_LOW: no deduction for SEO >= 0.8", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.8,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    const issue = result.issues.find((i) => i.code === "LH_SEO_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LH_A11Y_LOW ---

  it("LH_A11Y_LOW: deducts 5 for accessibility < 0.7", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.95,
        accessibility: 0.5,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_A11Y_LOW" }),
    );
  });

  it("LH_A11Y_LOW: no deduction for accessibility >= 0.7", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.95,
        accessibility: 0.7,
        best_practices: 0.92,
      },
    });
    const result = scorePerformanceFactors(page);
    const issue = result.issues.find((i) => i.code === "LH_A11Y_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LH_BP_LOW ---

  it("LH_BP_LOW: deducts 5 for best_practices < 0.8", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.6,
      },
    });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_BP_LOW" }),
    );
  });

  it("LH_BP_LOW: no deduction for best_practices >= 0.8", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.9,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.8,
      },
    });
    const result = scorePerformanceFactors(page);
    const issue = result.issues.find((i) => i.code === "LH_BP_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LARGE_PAGE_SIZE ---

  it("LARGE_PAGE_SIZE: deducts 10 for page > 3MB", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      pageSizeBytes: 4 * 1024 * 1024, // 4MB
    };
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LARGE_PAGE_SIZE" }),
    );
  });

  it("LARGE_PAGE_SIZE: no deduction for page <= 3MB", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      pageSizeBytes: 3 * 1024 * 1024, // exactly 3MB
    };
    const result = scorePerformanceFactors(page);
    const issue = result.issues.find((i) => i.code === "LARGE_PAGE_SIZE");
    expect(issue).toBeUndefined();
  });

  it("LARGE_PAGE_SIZE: no deduction when pageSizeBytes not set", () => {
    const result = scorePerformanceFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "LARGE_PAGE_SIZE");
    expect(issue).toBeUndefined();
  });

  // --- No Lighthouse ---

  it("no deductions when lighthouse is null", () => {
    const page = makePageData({ lighthouse: null });
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- Multiple issues ---

  it("accumulates multiple performance deductions", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.3, // -20
        seo: 0.5, // -15
        accessibility: 0.5, // -5
        best_practices: 0.5, // -5
      },
    });
    page.siteContext = {
      ...page.siteContext!,
      pageSizeBytes: 5 * 1024 * 1024, // -10
    };
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(45); // 100 - 20 - 15 - 5 - 5 - 10
    expect(result.issues).toHaveLength(5);
  });

  it("score never goes below 0", () => {
    const page = makePageData({
      lighthouse: {
        performance: 0.1, // -20
        seo: 0.1, // -15
        accessibility: 0.1, // -5
        best_practices: 0.1, // -5
      },
    });
    page.siteContext = {
      ...page.siteContext!,
      pageSizeBytes: 100 * 1024 * 1024, // -10, but already at low score
    };
    const result = scorePerformanceFactors(page);
    expect(result.score).toBe(45); // 100 - 20 - 15 - 5 - 5 - 10 = 45
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
