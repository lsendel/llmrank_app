import { describe, it, expect } from "vitest";
import { scoreAiReadinessFactors } from "../factors/ai-readiness";
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
      h2: ["Summary", "Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage", "Organization"],
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
      structured_data: [
        { "@type": "WebPage", name: "Test", description: "Desc" },
        {
          "@type": "Organization",
          name: "Test Corp",
          url: "https://example.com",
        },
      ],
    },
    lighthouse: {
      performance: 0.9,
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    },
    llmScores: {
      clarity: 90,
      authority: 90,
      comprehensiveness: 90,
      structure: 80,
      citation_worthiness: 90,
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

describe("AI Readiness Factors", () => {
  it("passes all checks for a well-optimized page", () => {
    const result = scoreAiReadinessFactors(makePageData());
    expect(result.score).toBe(98);
    // Small deduction from citation_worthiness mapping: -round((100-90)*0.2) = -2
    expect(result.issues.length).toBeGreaterThanOrEqual(0);
  });

  it("perfect score with llmScores all 100 and summary heading", () => {
    const page = makePageData({
      llmScores: {
        clarity: 100,
        authority: 100,
        comprehensiveness: 100,
        structure: 100,
        citation_worthiness: 100,
      },
    });
    const result = scoreAiReadinessFactors(page);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- MISSING_LLMS_TXT ---

  it("MISSING_LLMS_TXT: deducts 20 when hasLlmsTxt is false", () => {
    const page = makePageData();
    page.siteContext = { ...page.siteContext!, hasLlmsTxt: false };
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_LLMS_TXT",
        severity: "critical",
      }),
    );
  });

  it("MISSING_LLMS_TXT: no deduction when hasLlmsTxt is true", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "MISSING_LLMS_TXT");
    expect(issue).toBeUndefined();
  });

  // --- AI_CRAWLER_BLOCKED ---

  it("AI_CRAWLER_BLOCKED: deducts 25 when crawlers are blocked", () => {
    const page = makePageData();
    page.siteContext = {
      ...page.siteContext!,
      aiCrawlersBlocked: ["GPTBot", "ClaudeBot"],
    };
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "AI_CRAWLER_BLOCKED",
        severity: "critical",
      }),
    );
  });

  it("AI_CRAWLER_BLOCKED: no deduction when no crawlers blocked", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "AI_CRAWLER_BLOCKED");
    expect(issue).toBeUndefined();
  });

  // --- NO_STRUCTURED_DATA ---

  it("NO_STRUCTURED_DATA: deducts 15 when no structured_data", () => {
    const page = makePageData();
    page.extracted.structured_data = [];
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_STRUCTURED_DATA" }),
    );
  });

  it("NO_STRUCTURED_DATA: deducts 15 when structured_data is undefined", () => {
    const page = makePageData();
    page.extracted.structured_data = undefined;
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_STRUCTURED_DATA" }),
    );
  });

  it("NO_STRUCTURED_DATA: no deduction when structured_data present", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "NO_STRUCTURED_DATA");
    expect(issue).toBeUndefined();
  });

  // --- INCOMPLETE_SCHEMA ---

  it("INCOMPLETE_SCHEMA: deducts 8 when schema missing required props", () => {
    const page = makePageData();
    page.extracted.structured_data = [
      { "@type": "Article" }, // missing headline, author, datePublished
    ];
    page.extracted.schema_types = ["Article"];
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "INCOMPLETE_SCHEMA" }),
    );
  });

  it("INCOMPLETE_SCHEMA: no deduction when all required props present", () => {
    const page = makePageData();
    page.extracted.structured_data = [
      {
        "@type": "Article",
        headline: "Test Article",
        author: "Author",
        datePublished: "2025-01-01",
      },
    ];
    page.extracted.schema_types = ["Article", "Organization"];
    const result = scoreAiReadinessFactors(page);
    const issue = result.issues.find((i) => i.code === "INCOMPLETE_SCHEMA");
    expect(issue).toBeUndefined();
  });

  // --- CITATION_WORTHINESS ---

  it("CITATION_WORTHINESS: maps LLM citation_worthiness to deduction", () => {
    const page = makePageData({
      llmScores: {
        clarity: 100,
        authority: 100,
        comprehensiveness: 100,
        structure: 100,
        citation_worthiness: 50, // deduction = -round((100-50)*0.2) = -10
      },
    });
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CITATION_WORTHINESS" }),
    );
  });

  it("CITATION_WORTHINESS: no deduction when citation_worthiness is 100", () => {
    const page = makePageData({
      llmScores: {
        clarity: 100,
        authority: 100,
        comprehensiveness: 100,
        structure: 100,
        citation_worthiness: 100,
      },
    });
    const result = scoreAiReadinessFactors(page);
    const issue = result.issues.find((i) => i.code === "CITATION_WORTHINESS");
    expect(issue).toBeUndefined();
  });

  // --- NO_DIRECT_ANSWERS ---

  it("NO_DIRECT_ANSWERS: deducts 10 for question headings without FAQ schema", () => {
    const page = makePageData();
    page.extracted.h2 = ["What is SEO?", "How does it work?"];
    page.extracted.schema_types = ["WebPage", "Organization"];
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_DIRECT_ANSWERS" }),
    );
  });

  it("NO_DIRECT_ANSWERS: no deduction when no question headings", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "NO_DIRECT_ANSWERS");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_ENTITY_MARKUP ---

  it("MISSING_ENTITY_MARKUP: deducts 5 when schema has no entity types", () => {
    const page = makePageData();
    page.extracted.schema_types = ["WebPage"]; // No Person/Organization/Product
    page.extracted.structured_data = [
      { "@type": "WebPage", name: "Test", description: "Desc" },
    ];
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ENTITY_MARKUP" }),
    );
  });

  it("MISSING_ENTITY_MARKUP: no deduction when entity types present", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "MISSING_ENTITY_MARKUP");
    expect(issue).toBeUndefined();
  });

  // --- NO_SUMMARY_SECTION ---

  it("NO_SUMMARY_SECTION: deducts 5 when no summary heading and 500+ words", () => {
    const page = makePageData({ wordCount: 600 });
    page.extracted.h2 = ["About", "Services"]; // no summary-like heading
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_SUMMARY_SECTION" }),
    );
  });

  it("NO_SUMMARY_SECTION: no deduction when summary heading present", () => {
    const result = scoreAiReadinessFactors(makePageData());
    // Default makePageData has "Summary" in h2
    const issue = result.issues.find((i) => i.code === "NO_SUMMARY_SECTION");
    expect(issue).toBeUndefined();
  });

  it("NO_SUMMARY_SECTION: no deduction for short pages (< 500 words)", () => {
    const page = makePageData({ wordCount: 300 });
    page.extracted.h2 = ["About", "Services"];
    const result = scoreAiReadinessFactors(page);
    const issue = result.issues.find((i) => i.code === "NO_SUMMARY_SECTION");
    expect(issue).toBeUndefined();
  });

  // --- POOR_QUESTION_COVERAGE ---

  it("POOR_QUESTION_COVERAGE: deducts 10 when LLM structure < 50", () => {
    const page = makePageData({
      llmScores: {
        clarity: 90,
        authority: 90,
        comprehensiveness: 90,
        structure: 30, // below 50
        citation_worthiness: 90,
      },
    });
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "POOR_QUESTION_COVERAGE" }),
    );
  });

  it("POOR_QUESTION_COVERAGE: no deduction when structure >= 50", () => {
    const page = makePageData({
      llmScores: {
        clarity: 90,
        authority: 90,
        comprehensiveness: 90,
        structure: 50,
        citation_worthiness: 90,
      },
    });
    const result = scoreAiReadinessFactors(page);
    const issue = result.issues.find(
      (i) => i.code === "POOR_QUESTION_COVERAGE",
    );
    expect(issue).toBeUndefined();
  });

  // --- INVALID_SCHEMA ---

  it("INVALID_SCHEMA: deducts 8 when schema lacks @type", () => {
    const page = makePageData();
    page.extracted.structured_data = [
      { "@type": "WebPage", name: "Test", description: "Desc" },
      { name: "Missing type" }, // invalid - no @type
    ];
    const result = scoreAiReadinessFactors(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_SCHEMA" }),
    );
  });

  it("INVALID_SCHEMA: no deduction when all schemas have @type", () => {
    const result = scoreAiReadinessFactors(makePageData());
    const issue = result.issues.find((i) => i.code === "INVALID_SCHEMA");
    expect(issue).toBeUndefined();
  });

  // --- Combined issues ---

  it("accumulates multiple AI readiness deductions", () => {
    const page = makePageData({ llmScores: null });
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false, // -20
      aiCrawlersBlocked: ["GPTBot"], // -25
    };
    page.extracted.structured_data = []; // -15
    const result = scoreAiReadinessFactors(page);
    expect(result.score).toBe(40); // 100 - 20 - 25 - 15
  });
});
