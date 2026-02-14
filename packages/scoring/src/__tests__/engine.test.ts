import { describe, it, expect } from "vitest";
import { scorePage } from "../engine";
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
      h1: ["Main Heading - My Experience"],
      h2: ["Summary of Results", "Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage", "Organization"],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://external.gov"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "/img.png",
      },
      structured_data: [
        { "@type": "WebPage", name: "Test", description: "Desc" },
        {
          "@type": "Organization",
          name: "Test Corp",
          url: "https://example.com",
        },
      ],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 20,
      top_transition_words: ["however", "therefore"],
    },
    lighthouse: {
      performance: 0.95,
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    },
    llmScores: {
      clarity: 100,
      authority: 100,
      comprehensiveness: 100,
      structure: 100,
      citation_worthiness: 100,
    },
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
    ...overrides,
  };
}

describe("Scoring Engine (scorePage)", () => {
  // --- Perfect page ---

  it("returns score 100 and grade A for a perfect page", () => {
    const result = scorePage(makePageData());
    expect(result.overallScore).toBe(100);
    expect(result.letterGrade).toBe("A");
    expect(result.technicalScore).toBe(100);
    expect(result.contentScore).toBe(100);
    expect(result.aiReadinessScore).toBe(100);
    expect(result.performanceScore).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- 4xx/5xx special case ---

  it("returns score 0 and grade F for a 404 page", () => {
    const result = scorePage(makePageData({ statusCode: 404 }));
    expect(result.overallScore).toBe(0);
    expect(result.letterGrade).toBe("F");
    expect(result.technicalScore).toBe(0);
    expect(result.contentScore).toBe(0);
    expect(result.aiReadinessScore).toBe(0);
    expect(result.performanceScore).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("HTTP_STATUS");
  });

  it("returns score 0 for a 500 page", () => {
    const result = scorePage(makePageData({ statusCode: 500 }));
    expect(result.overallScore).toBe(0);
    expect(result.letterGrade).toBe("F");
  });

  it("returns score 0 for a 503 page", () => {
    const result = scorePage(makePageData({ statusCode: 503 }));
    expect(result.overallScore).toBe(0);
  });

  // --- Grade boundaries ---

  it("grade A for score >= 90", () => {
    // Perfect page gets 100
    const result = scorePage(makePageData());
    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.letterGrade).toBe("A");
  });

  it("grade B for score 80-89", () => {
    // tech: -15 (title) -10 (meta) = 75
    // content: 100
    // ai: -20 (no llms.txt) -15 (no structured data) = 65
    // perf: 100
    // weighted: 75*0.25 + 100*0.3 + 65*0.3 + 100*0.15 = 18.75+30+19.5+15 = 83.25 -> 83
    const page = makePageData({
      title: null,
      metaDescription: null,
      llmScores: null,
    });
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false,
    };
    page.extracted.structured_data = [];
    const result = scorePage(page);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.overallScore).toBeLessThan(90);
    expect(result.letterGrade).toBe("B");
  });

  it("grade C for score 70-79", () => {
    // tech: 100-15-10-8-8 = 59
    // content: 100
    // ai: 100-20-25-15 = 40
    // perf: 100
    // weighted: 59*0.25+100*0.3+40*0.3+100*0.15 = 14.75+30+12+15 = 71.75 -> 72
    const page = makePageData({
      title: null, // technical: -15
      metaDescription: null, // technical: -10
      canonicalUrl: null, // technical: -8
      llmScores: null,
    });
    page.extracted.h1 = ["Main Heading - Our Experience"]; // raising score with EEAT marker
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false, // AI readiness: -20
      aiCrawlersBlocked: ["GPTBot"], // AI readiness: -25
    };
    page.extracted.structured_data = []; // AI readiness: -15
    page.extracted.external_links = ["https://site.gov"]; // raising score with authoritative citation
    const result = scorePage(page);
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.letterGrade).toBe("C");
  });

  it("grade F for score < 60", () => {
    const page = makePageData({
      title: null, // technical: -15
      metaDescription: null, // technical: -10
      canonicalUrl: null, // technical: -8
      wordCount: 50, // content: -15
      llmScores: null,
    });
    page.extracted.h1 = []; // technical: -8
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"]; // technical: -20
    page.extracted.images_without_alt = 10; // technical: -15
    page.extracted.og_tags = undefined; // technical: -5
    page.extracted.internal_links = []; // content: -8
    page.extracted.structured_data = []; // AI readiness: -15
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false, // AI readiness: -20
      aiCrawlersBlocked: ["GPTBot", "ClaudeBot"], // AI readiness: -25
      hasSitemap: false, // technical: -5
    };
    page.lighthouse = {
      performance: 0.3, // performance: -20
      seo: 0.5, // performance: -15
      accessibility: 0.3, // performance: -5
      best_practices: 0.3, // performance: -5
    };
    const result = scorePage(page);
    expect(result.overallScore).toBeLessThan(60);
    expect(result.letterGrade).toBe("F");
  });

  // --- Weighted aggregation ---

  it("correctly applies weights: tech=0.25, content=0.3, ai=0.3, perf=0.15", () => {
    // Create a page where we can predict the exact score
    // All perfect except technical which has title issue (-15)
    const page = makePageData({ title: null }); // technical: -15 -> 85
    const result = scorePage(page);
    // tech=85, content=100, ai=100, perf=100
    // weighted: 85*0.25 + 100*0.3 + 100*0.3 + 100*0.15
    //         = 21.25 + 30 + 30 + 15 = 96.25 -> 96
    expect(result.overallScore).toBe(96);
    expect(result.technicalScore).toBe(85);
    expect(result.contentScore).toBe(100);
    expect(result.aiReadinessScore).toBe(100);
    expect(result.performanceScore).toBe(100);
  });

  // --- Issue sorting ---

  it("sorts issues by severity: critical > warning > info", () => {
    const page = makePageData({
      title: null, // critical: MISSING_TITLE
      llmScores: null,
    });
    page.extracted.og_tags = undefined; // info: MISSING_OG_TAGS
    page.extracted.internal_links = []; // warning: NO_INTERNAL_LINKS
    page.siteContext = {
      ...page.siteContext!,
      hasSitemap: false, // info: MISSING_SITEMAP
    };

    const result = scorePage(page);
    // Check sorting order
    const severities = result.issues.map((i) => i.severity);
    const criticalIdx = severities.indexOf("critical");
    const warningIdx = severities.indexOf("warning");
    const infoIdx = severities.indexOf("info");

    if (criticalIdx !== -1 && warningIdx !== -1) {
      expect(criticalIdx).toBeLessThan(warningIdx);
    }
    if (warningIdx !== -1 && infoIdx !== -1) {
      expect(warningIdx).toBeLessThan(infoIdx);
    }
  });

  // --- Issues from all categories ---

  it("includes issues from all four factor categories", () => {
    const page = makePageData({
      title: null, // technical
      wordCount: 100, // content: THIN_CONTENT
      llmScores: null,
    });
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false, // AI readiness
    };
    page.lighthouse = {
      performance: 0.3, // performance
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    };

    const result = scorePage(page);
    const categories = new Set(result.issues.map((i) => i.category));
    expect(categories.has("technical")).toBe(true);
    expect(categories.has("content")).toBe(true);
    expect(categories.has("ai_readiness")).toBe(true);
    expect(categories.has("performance")).toBe(true);
  });

  // --- Edge cases ---

  it("handles page with no siteContext gracefully", () => {
    const page = makePageData();
    page.siteContext = undefined;
    const result = scorePage(page);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("handles page with no lighthouse data gracefully", () => {
    const page = makePageData({ lighthouse: null });
    const result = scorePage(page);
    expect(result.performanceScore).toBe(100);
  });

  it("handles page with no llmScores gracefully", () => {
    const page = makePageData({ llmScores: null });
    const result = scorePage(page);
    // Should not crash, LLM-based factors should be skipped
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("result overallScore matches weighted formula", () => {
    const page = makePageData({
      llmScores: null,
    });
    page.extracted.internal_links = []; // content: -8
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false, // AI readiness: -20
    };
    page.lighthouse = {
      performance: 0.6, // performance: -10
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    };

    const result = scorePage(page);
    const expected = Math.round(
      result.technicalScore * 0.25 +
        result.contentScore * 0.3 +
        result.aiReadinessScore * 0.3 +
        result.performanceScore * 0.15,
    );
    expect(result.overallScore).toBe(expected);
  });

  // --- 301 redirect should be scored normally ---

  it("scores a 301 redirect page normally (not as error)", () => {
    const result = scorePage(makePageData({ statusCode: 301 }));
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.letterGrade).not.toBe("F");
  });

  // --- Minimum score is 0 ---

  it("overallScore is never negative", () => {
    const page = makePageData({
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      wordCount: 50,
      llmScores: null,
    });
    page.extracted.h1 = [];
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    page.extracted.images_without_alt = 10;
    page.extracted.og_tags = undefined;
    page.extracted.internal_links = [];
    page.extracted.structured_data = [];
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false,
      aiCrawlersBlocked: ["GPTBot", "ClaudeBot"],
      hasSitemap: false,
      responseTimeMs: 5000,
      pageSizeBytes: 10 * 1024 * 1024,
    };
    page.lighthouse = {
      performance: 0.1,
      seo: 0.1,
      accessibility: 0.1,
      best_practices: 0.1,
    };
    const result = scorePage(page);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});
