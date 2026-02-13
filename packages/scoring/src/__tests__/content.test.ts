import { describe, it, expect } from "vitest";
import { scoreContentFactors } from "../factors/content";
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

describe("Content Quality Factors", () => {
  it("passes all checks for a well-optimized page", () => {
    const result = scoreContentFactors(makePageData());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- THIN_CONTENT ---

  it("THIN_CONTENT: deducts 15 for fewer than 200 words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 100 }));
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "THIN_CONTENT" }),
    );
  });

  it("THIN_CONTENT: deducts 8 for 200-499 words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 300 }));
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "THIN_CONTENT" }),
    );
  });

  it("THIN_CONTENT: no deduction for 500+ words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 500 }));
    const issue = result.issues.find((i) => i.code === "THIN_CONTENT");
    expect(issue).toBeUndefined();
  });

  it("THIN_CONTENT: deducts 15 for 0 words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 0 }));
    expect(result.score).toBe(85);
  });

  it("THIN_CONTENT: deducts 8 for exactly 200 words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 200 }));
    expect(result.score).toBe(92);
  });

  it("THIN_CONTENT: deducts 8 for exactly 499 words", () => {
    const result = scoreContentFactors(makePageData({ wordCount: 499 }));
    expect(result.score).toBe(92);
  });

  // --- CONTENT_DEPTH / CLARITY / AUTHORITY ---

  it("CONTENT_DEPTH: maps LLM comprehensiveness score to deduction", () => {
    const result = scoreContentFactors(
      makePageData({
        llmScores: {
          clarity: 100,
          authority: 100,
          comprehensiveness: 50, // deduction = -round((100-50)*0.2) = -10
          structure: 100,
          citation_worthiness: 100,
        },
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_DEPTH" }),
    );
    // Score = 100 - 10 = 90
    expect(result.score).toBe(90);
  });

  it("CONTENT_CLARITY: maps LLM clarity score to deduction", () => {
    const result = scoreContentFactors(
      makePageData({
        llmScores: {
          clarity: 60, // deduction = -round((100-60)*0.2) = -8
          authority: 100,
          comprehensiveness: 100,
          structure: 100,
          citation_worthiness: 100,
        },
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_CLARITY" }),
    );
    expect(result.score).toBe(92);
  });

  it("CONTENT_AUTHORITY: maps LLM authority score to deduction", () => {
    const result = scoreContentFactors(
      makePageData({
        llmScores: {
          clarity: 100,
          authority: 40, // deduction = -round((100-40)*0.2) = -12
          comprehensiveness: 100,
          structure: 100,
          citation_worthiness: 100,
        },
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_AUTHORITY" }),
    );
    expect(result.score).toBe(88);
  });

  it("LLM scores: no deduction when all LLM scores are 100", () => {
    const result = scoreContentFactors(
      makePageData({
        llmScores: {
          clarity: 100,
          authority: 100,
          comprehensiveness: 100,
          structure: 100,
          citation_worthiness: 100,
        },
      }),
    );
    const llmIssues = result.issues.filter((i) =>
      ["CONTENT_DEPTH", "CONTENT_CLARITY", "CONTENT_AUTHORITY"].includes(
        i.code,
      ),
    );
    expect(llmIssues).toHaveLength(0);
  });

  it("LLM scores: skipped when llmScores is null", () => {
    const result = scoreContentFactors(makePageData({ llmScores: null }));
    const llmIssues = result.issues.filter((i) =>
      ["CONTENT_DEPTH", "CONTENT_CLARITY", "CONTENT_AUTHORITY"].includes(
        i.code,
      ),
    );
    expect(llmIssues).toHaveLength(0);
  });

  // --- DUPLICATE_CONTENT ---

  it("DUPLICATE_CONTENT: deducts 15 for matching contentHash", () => {
    const hashes = new Map([["abc123", "https://example.com/other"]]);
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      contentHashes: hashes,
    };
    const result = scoreContentFactors(page);
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_CONTENT" }),
    );
  });

  it("DUPLICATE_CONTENT: no deduction when hash maps to same URL", () => {
    const hashes = new Map([["abc123", "https://example.com/test"]]);
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      contentHashes: hashes,
    };
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "DUPLICATE_CONTENT");
    expect(issue).toBeUndefined();
  });

  it("DUPLICATE_CONTENT: no deduction when hash not found", () => {
    const hashes = new Map([["different-hash", "https://example.com/other"]]);
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      contentHashes: hashes,
    };
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "DUPLICATE_CONTENT");
    expect(issue).toBeUndefined();
  });

  // --- NO_INTERNAL_LINKS ---

  it("NO_INTERNAL_LINKS: deducts 8 for fewer than 2 internal links", () => {
    const page = makePageData();
    page.extracted.internal_links = ["/about"];
    const result = scoreContentFactors(page);
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_INTERNAL_LINKS" }),
    );
  });

  it("NO_INTERNAL_LINKS: deducts 8 for 0 internal links", () => {
    const page = makePageData();
    page.extracted.internal_links = [];
    const result = scoreContentFactors(page);
    expect(result.score).toBe(92);
  });

  it("NO_INTERNAL_LINKS: no deduction for 2+ internal links", () => {
    const page = makePageData();
    page.extracted.internal_links = ["/about", "/contact"];
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "NO_INTERNAL_LINKS");
    expect(issue).toBeUndefined();
  });

  // --- EXCESSIVE_LINKS ---

  it("EXCESSIVE_LINKS: deducts 3 when external > internal * 3", () => {
    const page = makePageData();
    page.extracted.internal_links = ["/about"];
    page.extracted.external_links = [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
    ]; // 4 > 1*3
    const result = scoreContentFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "EXCESSIVE_LINKS" }),
    );
  });

  it("EXCESSIVE_LINKS: no deduction when external <= internal * 3", () => {
    const page = makePageData();
    page.extracted.internal_links = ["/about", "/blog"];
    page.extracted.external_links = [
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]; // 3 <= 2*3
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "EXCESSIVE_LINKS");
    expect(issue).toBeUndefined();
  });

  it("EXCESSIVE_LINKS: no deduction when no internal links (avoids divide-by-zero logic)", () => {
    const page = makePageData();
    page.extracted.internal_links = [];
    page.extracted.external_links = ["https://a.com", "https://b.com"];
    const result = scoreContentFactors(page);
    // Should flag NO_INTERNAL_LINKS but not EXCESSIVE_LINKS (since internalCount is 0)
    const excessiveIssue = result.issues.find(
      (i) => i.code === "EXCESSIVE_LINKS",
    );
    expect(excessiveIssue).toBeUndefined();
  });

  // --- MISSING_FAQ_STRUCTURE ---

  it("MISSING_FAQ_STRUCTURE: deducts 5 for question headings without FAQ schema", () => {
    const page = makePageData();
    page.extracted.h2 = ["What is SEO?", "How does it work?"];
    page.extracted.schema_types = ["WebPage"]; // no FAQPage
    const result = scoreContentFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_FAQ_STRUCTURE" }),
    );
  });

  it("MISSING_FAQ_STRUCTURE: no deduction when FAQPage schema present", () => {
    const page = makePageData();
    page.extracted.h2 = ["What is SEO?", "How does it work?"];
    page.extracted.schema_types = ["WebPage", "FAQPage"];
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "MISSING_FAQ_STRUCTURE");
    expect(issue).toBeUndefined();
  });

  it("MISSING_FAQ_STRUCTURE: no deduction when no question headings", () => {
    const page = makePageData();
    page.extracted.h2 = ["About Us", "Our Services"];
    const result = scoreContentFactors(page);
    const issue = result.issues.find((i) => i.code === "MISSING_FAQ_STRUCTURE");
    expect(issue).toBeUndefined();
  });

  // --- STALE_CONTENT ---

  it("STALE_CONTENT: deducts 5 when staleContent flag is set", () => {
    const page = makePageData();
    (page.siteContext as Record<string, unknown>).staleContent = true;
    const result = scoreContentFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "STALE_CONTENT" }),
    );
  });

  // --- Multiple issues ---

  it("accumulates multiple content deductions", () => {
    const page = makePageData({ wordCount: 100 }); // -15
    page.extracted.internal_links = []; // -8
    const result = scoreContentFactors(page);
    expect(result.score).toBe(77); // 100 - 15 - 8
  });
});
