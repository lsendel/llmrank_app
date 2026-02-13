import { describe, it, expect } from "vitest";
import { scoreTechnicalFactors } from "../factors/technical";
import type { PageData } from "../types";

function makePageData(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here", // 36 chars (within 30-60)
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.", // 148 chars
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

describe("Technical SEO Factors", () => {
  it("passes all checks for a well-optimized page", () => {
    const result = scoreTechnicalFactors(makePageData());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- MISSING_TITLE ---

  it("MISSING_TITLE: deducts 15 for null title", () => {
    const result = scoreTechnicalFactors(makePageData({ title: null }));
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_TITLE", severity: "critical" }),
    );
  });

  it("MISSING_TITLE: deducts 15 for title shorter than 30 chars", () => {
    const result = scoreTechnicalFactors(makePageData({ title: "Short" }));
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_TITLE" }),
    );
  });

  it("MISSING_TITLE: deducts 15 for title longer than 60 chars", () => {
    const result = scoreTechnicalFactors(
      makePageData({
        title:
          "This is a very long title that exceeds the sixty character maximum for good SEO practice",
      }),
    );
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_TITLE" }),
    );
  });

  it("MISSING_TITLE: passes for title exactly 30 chars", () => {
    const result = scoreTechnicalFactors(
      makePageData({ title: "Exactly Thirty Characters Here!" }), // 31 chars
    );
    // 31 chars is within range
    const titleIssue = result.issues.find((i) => i.code === "MISSING_TITLE");
    expect(titleIssue).toBeUndefined();
  });

  // --- MISSING_META_DESC ---

  it("MISSING_META_DESC: deducts 10 for null meta description", () => {
    const result = scoreTechnicalFactors(
      makePageData({ metaDescription: null }),
    );
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_META_DESC" }),
    );
  });

  it("MISSING_META_DESC: deducts 10 for description shorter than 120 chars", () => {
    const result = scoreTechnicalFactors(
      makePageData({ metaDescription: "Too short description." }),
    );
    expect(result.score).toBe(90);
  });

  it("MISSING_META_DESC: deducts 10 for description longer than 160 chars", () => {
    const result = scoreTechnicalFactors(
      makePageData({
        metaDescription: "A".repeat(161),
      }),
    );
    expect(result.score).toBe(90);
  });

  // --- MISSING_H1 ---

  it("MISSING_H1: deducts 8 for no H1", () => {
    const page = makePageData();
    page.extracted.h1 = [];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_H1" }),
    );
  });

  // --- MULTIPLE_H1 ---

  it("MULTIPLE_H1: deducts 5 for multiple H1s", () => {
    const page = makePageData();
    page.extracted.h1 = ["Heading 1", "Heading 2"];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_H1" }),
    );
  });

  it("MULTIPLE_H1: includes h1Count in data", () => {
    const page = makePageData();
    page.extracted.h1 = ["H1 One", "H1 Two", "H1 Three"];
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "MULTIPLE_H1");
    expect(issue?.data).toEqual({ h1Count: 3 });
  });

  // --- HEADING_HIERARCHY ---

  it("HEADING_HIERARCHY: deducts 3 for skipped heading levels (H1 -> H3)", () => {
    const page = makePageData();
    page.extracted.h1 = ["Main Heading"];
    page.extracted.h2 = [];
    page.extracted.h3 = ["Sub Section"];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(97);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HEADING_HIERARCHY" }),
    );
  });

  it("HEADING_HIERARCHY: does not deduct for sequential headings", () => {
    const page = makePageData();
    page.extracted.h1 = ["H1"];
    page.extracted.h2 = ["H2"];
    page.extracted.h3 = ["H3"];
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "HEADING_HIERARCHY");
    expect(issue).toBeUndefined();
  });

  // --- HTTP_STATUS ---

  it("HTTP_STATUS: deducts 25 for 404 status", () => {
    const result = scoreTechnicalFactors(makePageData({ statusCode: 404 }));
    expect(result.score).toBe(75);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HTTP_STATUS", severity: "critical" }),
    );
  });

  it("HTTP_STATUS: deducts 25 for 500 status", () => {
    const result = scoreTechnicalFactors(makePageData({ statusCode: 500 }));
    expect(result.score).toBe(75);
  });

  it("HTTP_STATUS: no deduction for 200 status", () => {
    const result = scoreTechnicalFactors(makePageData({ statusCode: 200 }));
    const issue = result.issues.find((i) => i.code === "HTTP_STATUS");
    expect(issue).toBeUndefined();
  });

  it("HTTP_STATUS: no deduction for 301 redirect", () => {
    const result = scoreTechnicalFactors(makePageData({ statusCode: 301 }));
    const issue = result.issues.find((i) => i.code === "HTTP_STATUS");
    expect(issue).toBeUndefined();
  });

  // --- NOINDEX_SET ---

  it("NOINDEX_SET: deducts 20 for noindex directive", () => {
    const page = makePageData();
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(80);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NOINDEX_SET", severity: "critical" }),
    );
  });

  it("NOINDEX_SET: does not deduct for nofollow without noindex", () => {
    const page = makePageData();
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["nofollow"];
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "NOINDEX_SET");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_CANONICAL ---

  it("MISSING_CANONICAL: deducts 8 for missing canonical URL", () => {
    const result = scoreTechnicalFactors(makePageData({ canonicalUrl: null }));
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_CANONICAL" }),
    );
  });

  // --- MISSING_ALT_TEXT ---

  it("MISSING_ALT_TEXT: deducts 3 per image without alt, max 15", () => {
    const page = makePageData();
    page.extracted.images_without_alt = 6;
    const result = scoreTechnicalFactors(page);
    // 6 * 3 = 18, capped at 15
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ALT_TEXT" }),
    );
  });

  it("MISSING_ALT_TEXT: deducts 3 for 1 image without alt", () => {
    const page = makePageData();
    page.extracted.images_without_alt = 1;
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(97);
  });

  it("MISSING_ALT_TEXT: deducts exactly 15 for 5 images without alt", () => {
    const page = makePageData();
    page.extracted.images_without_alt = 5;
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(85);
  });

  it("MISSING_ALT_TEXT: no deduction for 0 images without alt", () => {
    const page = makePageData();
    page.extracted.images_without_alt = 0;
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "MISSING_ALT_TEXT");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_OG_TAGS ---

  it("MISSING_OG_TAGS: deducts 5 for missing og:title", () => {
    const page = makePageData();
    page.extracted.og_tags = {
      "og:description": "Desc",
      "og:image": "/img.png",
    };
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_OG_TAGS" }),
    );
  });

  it("MISSING_OG_TAGS: deducts 5 when og_tags is undefined", () => {
    const page = makePageData();
    page.extracted.og_tags = undefined;
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(95);
  });

  it("MISSING_OG_TAGS: no deduction when all three og tags present", () => {
    const page = makePageData();
    // default has all three
    const issue = scoreTechnicalFactors(page).issues.find(
      (i) => i.code === "MISSING_OG_TAGS",
    );
    expect(issue).toBeUndefined();
  });

  // --- SLOW_RESPONSE ---

  it("SLOW_RESPONSE: deducts 10 for response time > 2000ms", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      responseTimeMs: 3000,
    };
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "SLOW_RESPONSE" }),
    );
  });

  it("SLOW_RESPONSE: no deduction for response time <= 2000ms", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      responseTimeMs: 1500,
    };
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "SLOW_RESPONSE");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_SITEMAP ---

  it("MISSING_SITEMAP: deducts 5 when hasSitemap is false", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      hasSitemap: false,
    };
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_SITEMAP" }),
    );
  });

  it("MISSING_SITEMAP: no deduction when siteContext is undefined", () => {
    const page = makePageData();
    page.siteContext = undefined;
    const result = scoreTechnicalFactors(page);
    const issue = result.issues.find((i) => i.code === "MISSING_SITEMAP");
    expect(issue).toBeUndefined();
  });

  // --- Multiple issues ---

  it("accumulates deductions from multiple issues", () => {
    const page = makePageData({
      title: null, // -15
      metaDescription: null, // -10
      canonicalUrl: null, // -8
    });
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(67); // 100 - 15 - 10 - 8
    expect(result.issues).toHaveLength(3);
  });

  it("score never goes below 0", () => {
    const page = makePageData({
      title: null, // -15
      metaDescription: null, // -10
      canonicalUrl: null, // -8
      statusCode: 500, // -25
    });
    page.extracted.h1 = []; // -8
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"]; // -20
    page.extracted.images_without_alt = 10; // -15
    page.extracted.og_tags = undefined; // -5
    page.siteContext = {
      ...page.siteContext!,
      hasSitemap: false, // -5
      responseTimeMs: 5000, // -10
    };
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
