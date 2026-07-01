import { describe, it, expect } from "vitest";
import { scoreContentCiteability } from "../../dimensions/content-citeability";
import type { PageData } from "../../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
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
      h1: ["My Experience Testing This Product"],
      h2: ["Section 1", "Key Takeaways"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://example.edu/research"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {},
      structured_data: [],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      flesch_score: 65,
      flesch_classification: "standard",
      text_html_ratio: 25,
      sentence_length_variance: 20,
      top_transition_words: ["however", "therefore"],
    },
    lighthouse: null,
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

describe("scoreContentCiteability", () => {
  it("returns 100 for a well-optimized page", () => {
    const result = scoreContentCiteability(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // === Heading Structure (from technical.ts) ===

  // --- MISSING_H1 ---

  it("MISSING_H1: deducts 8 for no H1", () => {
    const page = makePage();
    page.extracted.h1 = [];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_H1", severity: "warning" }),
    );
  });

  // --- MULTIPLE_H1 ---

  it("MULTIPLE_H1: deducts 5 for multiple H1s", () => {
    const page = makePage();
    page.extracted.h1 = [
      "My Experience Heading One",
      "My Experience Heading Two",
    ];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_H1" }),
    );
    const issue = result.issues.find((i) => i.code === "MULTIPLE_H1");
    expect(issue?.data).toEqual({ h1Count: 2 });
  });

  // --- HEADING_HIERARCHY ---

  it("HEADING_HIERARCHY: deducts 3 for skipped heading levels (H1 -> H3)", () => {
    const page = makePage();
    page.extracted.h1 = ["My Experience Testing This"];
    page.extracted.h2 = [];
    page.extracted.h3 = ["Sub Section"];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HEADING_HIERARCHY" }),
    );
    const issue = result.issues.find((i) => i.code === "HEADING_HIERARCHY");
    expect(issue?.data).toEqual({ skippedFrom: "H1", skippedTo: "H3" });
  });

  it("HEADING_HIERARCHY: no deduction for sequential headings", () => {
    const page = makePage();
    page.extracted.h1 = ["My Experience Testing"];
    page.extracted.h2 = ["Section 1", "Key Takeaways"];
    page.extracted.h3 = ["Detail"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "HEADING_HIERARCHY");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_ALT_TEXT ---

  it("MISSING_ALT_TEXT: deducts 3 per image without alt, capped at 15", () => {
    const page = makePage();
    page.extracted.images_without_alt = 6;
    const result = scoreContentCiteability(page);
    // 6 * 3 = 18, capped at 15
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ALT_TEXT" }),
    );
  });

  it("MISSING_ALT_TEXT: deducts 3 for 1 image without alt", () => {
    const page = makePage();
    page.extracted.images_without_alt = 1;
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ALT_TEXT" }),
    );
  });

  it("MISSING_ALT_TEXT: no deduction for 0 images without alt", () => {
    const page = makePage();
    page.extracted.images_without_alt = 0;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "MISSING_ALT_TEXT");
    expect(issue).toBeUndefined();
  });

  // === Content Quality (from content.ts) ===

  // --- THIN_CONTENT ---

  it("THIN_CONTENT: deducts 15 for < 200 words", () => {
    const page = makePage({ wordCount: 100 });
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "THIN_CONTENT" }),
    );
  });

  it("THIN_CONTENT: deducts 8 for 200-499 words", () => {
    const page = makePage({ wordCount: 300 });
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "THIN_CONTENT" }),
    );
  });

  it("THIN_CONTENT: no deduction for >= 500 words", () => {
    const page = makePage({ wordCount: 500 });
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "THIN_CONTENT");
    expect(issue).toBeUndefined();
  });

  // --- CONTENT_DEPTH (LLM-scored) ---

  it("CONTENT_DEPTH: deducts based on LLM comprehensiveness score", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 60,
        clarity: 100,
        authority: 100,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    // deduction = -round((100 - 60) * 0.2) = -8
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_DEPTH" }),
    );
    const issue = result.issues.find((i) => i.code === "CONTENT_DEPTH");
    expect(issue?.data).toEqual({ llmScore: 60 });
  });

  it("CONTENT_DEPTH: no deduction for perfect LLM comprehensiveness", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 100,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "CONTENT_DEPTH");
    expect(issue).toBeUndefined();
  });

  // --- CONTENT_CLARITY (LLM-scored) ---

  it("CONTENT_CLARITY: deducts based on LLM clarity score", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 50,
        authority: 100,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    // deduction = -round((100 - 50) * 0.2) = -10
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_CLARITY" }),
    );
  });

  // --- CONTENT_AUTHORITY (LLM-scored) ---

  it("CONTENT_AUTHORITY: deducts based on LLM authority score", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 70,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    // deduction = -round((100 - 70) * 0.2) = -6
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CONTENT_AUTHORITY" }),
    );
  });

  // --- DUPLICATE_CONTENT ---

  it("DUPLICATE_CONTENT: deducts 15 when content hash matches another URL", () => {
    const hashes = new Map<string, string>();
    hashes.set("abc123", "https://example.com/other-page");
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: hashes,
      },
    });
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_CONTENT" }),
    );
    const issue = result.issues.find((i) => i.code === "DUPLICATE_CONTENT");
    expect(issue?.data).toEqual({
      duplicateOf: "https://example.com/other-page",
    });
  });

  it("DUPLICATE_CONTENT: no deduction when hash matches own URL", () => {
    const hashes = new Map<string, string>();
    hashes.set("abc123", "https://example.com/test"); // Same URL as page
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: hashes,
      },
    });
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "DUPLICATE_CONTENT");
    expect(issue).toBeUndefined();
  });

  // --- NO_INTERNAL_LINKS ---

  it("NO_INTERNAL_LINKS: deducts 8 when fewer than 2 internal links", () => {
    const page = makePage();
    page.extracted.internal_links = ["/about"];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_INTERNAL_LINKS" }),
    );
  });

  it("NO_INTERNAL_LINKS: no deduction for 2+ internal links", () => {
    const page = makePage();
    page.extracted.internal_links = ["/about", "/contact"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "NO_INTERNAL_LINKS");
    expect(issue).toBeUndefined();
  });

  // --- EXCESSIVE_LINKS ---

  it("EXCESSIVE_LINKS: deducts 3 when external links exceed 3x internal links", () => {
    const page = makePage();
    page.extracted.internal_links = ["/about", "/contact"];
    page.extracted.external_links = [
      "https://a.edu",
      "https://b.com",
      "https://c.com",
      "https://d.com",
      "https://e.com",
      "https://f.com",
      "https://g.com",
    ]; // 7 external > 2*3 = 6
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "EXCESSIVE_LINKS" }),
    );
  });

  it("EXCESSIVE_LINKS: no deduction when external links <= 3x internal links", () => {
    const page = makePage();
    page.extracted.internal_links = ["/about", "/contact", "/blog"];
    page.extracted.external_links = ["https://a.edu", "https://b.com"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "EXCESSIVE_LINKS");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_FAQ_STRUCTURE ---

  it("MISSING_FAQ_STRUCTURE: deducts for a genuine FAQ (3+ question headings) without schema", () => {
    const page = makePage();
    page.extracted.h2 = [
      "What is SEO?",
      "How does it work?",
      "When should I start?",
    ];
    page.extracted.schema_types = [];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_FAQ_STRUCTURE" }),
    );
  });

  it("MISSING_FAQ_STRUCTURE: no deduction for a single question-style heading", () => {
    const page = makePage();
    page.extracted.h2 = ["What is SEO?", "Key Takeaways"];
    page.extracted.schema_types = [];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "MISSING_FAQ_STRUCTURE");
    expect(issue).toBeUndefined();
  });

  it("MISSING_FAQ_STRUCTURE: no deduction when FAQ schema is present", () => {
    const page = makePage();
    page.extracted.h2 = [
      "What is SEO?",
      "How does it work?",
      "When should I start?",
    ];
    page.extracted.schema_types = ["FAQPage"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "MISSING_FAQ_STRUCTURE");
    expect(issue).toBeUndefined();
  });

  it("MISSING_FAQ_STRUCTURE: no deduction when no question-like headings", () => {
    const page = makePage();
    // Default headings are not question-like
    page.extracted.h1 = ["My Experience Testing This Product"];
    page.extracted.h2 = ["Section 1", "Key Takeaways"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "MISSING_FAQ_STRUCTURE");
    expect(issue).toBeUndefined();
  });

  // --- POOR_READABILITY (recalibrated for AI-readiness) ---
  // Flesch is a NOISY proxy: its syllable term punishes polysyllabic
  // technical/clinical vocabulary that LLMs handle fine. So we only penalise the
  // genuinely-difficult (structural, long-sentence) bands, halve the severity,
  // and drop the bar from 60 to 50 — otherwise ~100% of well-written healthcare
  // pages false-fire. See factors/content.ts.

  it("POOR_READABILITY: deducts 6 for a very-difficult page (flesch < 30)", () => {
    const page = makePage();
    page.extracted.flesch_score = 20;
    page.extracted.flesch_classification = "very_difficult";
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "POOR_READABILITY");
    expect(issue).toBeDefined();
    expect(issue?.scoreImpact).toBe(-6);
  });

  it("POOR_READABILITY: deducts only 3 in the difficult band (30 <= flesch < 50)", () => {
    const page = makePage();
    page.extracted.flesch_score = 40; // typical authoritative technical prose
    page.extracted.flesch_classification = "difficult";
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "POOR_READABILITY");
    expect(issue).toBeDefined();
    expect(issue?.scoreImpact).toBe(-3);
  });

  it("POOR_READABILITY: fires at the very-poor boundary edges correctly", () => {
    // Exactly 30 is NOT very-poor (uses `<`), so it lands in the -3 band.
    const at30 = makePage();
    at30.extracted.flesch_score = 30;
    expect(
      scoreContentCiteability(at30).issues.find(
        (i) => i.code === "POOR_READABILITY",
      )?.scoreImpact,
    ).toBe(-3);
    // Just below 30 is very-poor → -6.
    const below = makePage();
    below.extracted.flesch_score = 29.9;
    expect(
      scoreContentCiteability(below).issues.find(
        (i) => i.code === "POOR_READABILITY",
      )?.scoreImpact,
    ).toBe(-6);
  });

  it("POOR_READABILITY: no deduction at/above the 50 bar (fairly-difficult prose is fine)", () => {
    // 55 used to lose -5 under the old 60 bar; recalibration clears it. This is
    // the healthcare/technical false-positive fix.
    for (const score of [50, 55, 65]) {
      const page = makePage();
      page.extracted.flesch_score = score;
      const result = scoreContentCiteability(page);
      const issue = result.issues.find((i) => i.code === "POOR_READABILITY");
      expect(issue).toBeUndefined();
    }
  });

  it("POOR_READABILITY: no deduction when flesch_score is null", () => {
    const page = makePage();
    page.extracted.flesch_score = null;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "POOR_READABILITY");
    expect(issue).toBeUndefined();
  });

  // --- LOW_TEXT_HTML_RATIO ---

  it("LOW_TEXT_HTML_RATIO: deducts 8 when text_html_ratio < 15", () => {
    const page = makePage();
    page.extracted.text_html_ratio = 10;
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LOW_TEXT_HTML_RATIO" }),
    );
  });

  it("LOW_TEXT_HTML_RATIO: no deduction when text_html_ratio >= 15", () => {
    const page = makePage();
    page.extracted.text_html_ratio = 25;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_TEXT_HTML_RATIO");
    expect(issue).toBeUndefined();
  });

  it("LOW_TEXT_HTML_RATIO: no deduction when text_html_ratio is null", () => {
    const page = makePage();
    page.extracted.text_html_ratio = null;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_TEXT_HTML_RATIO");
    expect(issue).toBeUndefined();
  });

  // --- AI_ASSISTANT_SPEAK ---

  it("AI_ASSISTANT_SPEAK: deducts 10 when 3+ formulaic AI tells detected", () => {
    const page = makePage();
    page.extracted.top_transition_words = [
      "in conclusion",
      "it is important to note",
      "to summarize",
    ];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "AI_ASSISTANT_SPEAK" }),
    );
  });

  it("AI_ASSISTANT_SPEAK: no deduction for fewer than 3 assistant words", () => {
    const page = makePage();
    page.extracted.top_transition_words = ["in conclusion", "to summarize"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "AI_ASSISTANT_SPEAK");
    expect(issue).toBeUndefined();
  });

  it("AI_ASSISTANT_SPEAK: does not penalize ordinary human connectives", () => {
    // Regression: "moreover"/"furthermore"/"essentially"/"ultimately" are
    // everyday prose and used to trip this flag, penalizing good writing.
    const page = makePage();
    page.extracted.top_transition_words = [
      "moreover",
      "furthermore",
      "essentially",
      "ultimately",
    ];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "AI_ASSISTANT_SPEAK");
    expect(issue).toBeUndefined();
  });

  it("AI_ASSISTANT_SPEAK: does not count non-AI transition words", () => {
    const page = makePage();
    page.extracted.top_transition_words = [
      "however",
      "therefore",
      "additionally",
    ];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "AI_ASSISTANT_SPEAK");
    expect(issue).toBeUndefined();
  });

  // --- UNIFORM_SENTENCE_LENGTH ---

  it("UNIFORM_SENTENCE_LENGTH: deducts 5 when variance < 8 and word count >= 200", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.sentence_length_variance = 5;
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "UNIFORM_SENTENCE_LENGTH" }),
    );
  });

  it("UNIFORM_SENTENCE_LENGTH: no deduction when wordCount < 200", () => {
    const page = makePage({ wordCount: 100 });
    page.extracted.sentence_length_variance = 5;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "UNIFORM_SENTENCE_LENGTH",
    );
    expect(issue).toBeUndefined();
  });

  it("UNIFORM_SENTENCE_LENGTH: no deduction for ordinary varied prose (variance 8-15)", () => {
    // Regression: variance of 10 is normal varied writing and used to be
    // flagged as robotic. Only genuinely monotonous (<8) content should trip.
    const page = makePage({ wordCount: 500 });
    page.extracted.sentence_length_variance = 12;
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "UNIFORM_SENTENCE_LENGTH",
    );
    expect(issue).toBeUndefined();
  });

  // --- LOW_EEAT_SCORE ---

  it("LOW_EEAT_SCORE: deducts 15 when the page has no E-E-A-T signal at all", () => {
    const page = makePage({ wordCount: 600 });
    page.extracted.h1 = ["SEO Guide"];
    page.extracted.h2 = ["Best Practices", "Key Takeaways"];
    page.extracted.schema_types = [];
    page.extracted.structured_data = [];
    page.extracted.external_links = ["https://competitor.com/blog"];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LOW_EEAT_SCORE" }),
    );
  });

  it("LOW_EEAT_SCORE: no deduction when experience markers present in H1", () => {
    const page = makePage({ wordCount: 600 });
    // Default page has "My Experience Testing This Product" in h1
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_EEAT_SCORE");
    expect(issue).toBeUndefined();
  });

  it("LOW_EEAT_SCORE: no deduction for attributed content (Article + author schema)", () => {
    // Regression: headings-only detection fired on nearly every long page.
    // Authorship structured data is a real E-E-A-T signal.
    const page = makePage({ wordCount: 600 });
    page.extracted.h1 = ["SEO Guide"];
    page.extracted.h2 = ["Best Practices"];
    page.extracted.external_links = [];
    page.extracted.schema_types = ["Article"];
    page.extracted.structured_data = [{ "@type": "Article", author: "Jane" }];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_EEAT_SCORE");
    expect(issue).toBeUndefined();
  });

  it("LOW_EEAT_SCORE: no deduction when citing authoritative sources", () => {
    const page = makePage({ wordCount: 600 });
    page.extracted.h1 = ["SEO Guide"];
    page.extracted.h2 = ["Best Practices"];
    page.extracted.schema_types = [];
    page.extracted.structured_data = [];
    page.extracted.external_links = ["https://nih.gov/study"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_EEAT_SCORE");
    expect(issue).toBeUndefined();
  });

  it("LOW_EEAT_SCORE: no deduction when wordCount < 500", () => {
    const page = makePage({ wordCount: 300 });
    page.extracted.h1 = ["SEO Guide"];
    page.extracted.h2 = ["Best Practices"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "LOW_EEAT_SCORE");
    expect(issue).toBeUndefined();
  });

  // === AI Readiness (from ai-readiness.ts) ===

  // --- MISSING_AUTHORITATIVE_CITATIONS ---

  it("MISSING_AUTHORITATIVE_CITATIONS: deducts 5 when no .gov/.edu/.org links and wordCount > 300", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.external_links = ["https://example.com"];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_AUTHORITATIVE_CITATIONS" }),
    );
  });

  it("MISSING_AUTHORITATIVE_CITATIONS: no deduction when .edu link exists", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.external_links = ["https://example.edu/research"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "MISSING_AUTHORITATIVE_CITATIONS",
    );
    expect(issue).toBeUndefined();
  });

  it("MISSING_AUTHORITATIVE_CITATIONS: no deduction when wordCount <= 300", () => {
    const page = makePage({ wordCount: 200 });
    page.extracted.external_links = ["https://example.com"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "MISSING_AUTHORITATIVE_CITATIONS",
    );
    expect(issue).toBeUndefined();
  });

  it("MISSING_AUTHORITATIVE_CITATIONS: '.org' in a URL path no longer counts as authoritative", () => {
    // Regression: includes('.org') matched the substring anywhere in the URL
    // (paths, slugs), so junk links falsely passed as authoritative citations.
    const page = makePage({ wordCount: 500 });
    page.extracted.external_links = [
      "https://shop.com/blog/best.organic-foods",
      "https://news.com/category/.org-charts",
    ];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_AUTHORITATIVE_CITATIONS" }),
    );
  });

  it("MISSING_AUTHORITATIVE_CITATIONS: recognizes ccTLD government/academic hosts", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.external_links = ["https://www.nhs.gov.uk/guidance"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "MISSING_AUTHORITATIVE_CITATIONS",
    );
    expect(issue).toBeUndefined();
  });

  // --- CITATION_WORTHINESS (LLM-scored) ---

  it("CITATION_WORTHINESS: deducts based on LLM citation_worthiness score", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 100,
        structure: 80,
        citation_worthiness: 50,
      },
    });
    const result = scoreContentCiteability(page);
    // deduction = -round((100 - 50) * 0.2) = -10
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CITATION_WORTHINESS" }),
    );
  });

  it("CITATION_WORTHINESS: no deduction for perfect citation_worthiness", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 100,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "CITATION_WORTHINESS");
    expect(issue).toBeUndefined();
  });

  // --- NO_DIRECT_ANSWERS ---

  it("NO_DIRECT_ANSWERS: deducts 10 when question headings without FAQ schema and wordCount >= 200", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.h2 = ["What is SEO?", "Key Takeaways"];
    page.extracted.schema_types = [];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_DIRECT_ANSWERS" }),
    );
  });

  it("NO_DIRECT_ANSWERS: no deduction when FAQ schema present", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.h2 = ["What is SEO?"];
    page.extracted.schema_types = ["FAQPage"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "NO_DIRECT_ANSWERS");
    expect(issue).toBeUndefined();
  });

  // --- NO_SUMMARY_SECTION ---

  it("NO_SUMMARY_SECTION: deducts 5 when no summary heading and wordCount >= 500", () => {
    const page = makePage({ wordCount: 600 });
    page.extracted.h1 = ["My Experience With SEO"];
    page.extracted.h2 = ["Section 1", "Section 2"];
    page.extracted.h3 = [];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_SUMMARY_SECTION" }),
    );
  });

  it("NO_SUMMARY_SECTION: no deduction when Key Takeaways heading exists", () => {
    const page = makePage({ wordCount: 600 });
    // Default page has "Key Takeaways" in h2
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "NO_SUMMARY_SECTION");
    expect(issue).toBeUndefined();
  });

  it("NO_SUMMARY_SECTION: no deduction when wordCount < 500", () => {
    const page = makePage({ wordCount: 300 });
    page.extracted.h2 = ["Section 1"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "NO_SUMMARY_SECTION");
    expect(issue).toBeUndefined();
  });

  it("NO_SUMMARY_SECTION: no deduction for a German summary heading (multilingual)", () => {
    const page = makePage({ wordCount: 600 });
    page.extracted.h1 = ["Pflege zu Hause"];
    page.extracted.h2 = ["Leistungen", "Zusammenfassung"]; // de summary heading
    page.extracted.h3 = [];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "NO_SUMMARY_SECTION");
    expect(issue).toBeUndefined();
  });

  // --- POOR_QUESTION_COVERAGE ---

  it("POOR_QUESTION_COVERAGE: deducts 10 when LLM structure score < 50", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 100,
        structure: 30,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "POOR_QUESTION_COVERAGE" }),
    );
  });

  it("POOR_QUESTION_COVERAGE: no deduction when structure score >= 50", () => {
    const page = makePage({
      llmScores: {
        comprehensiveness: 100,
        clarity: 100,
        authority: 100,
        structure: 80,
        citation_worthiness: 100,
      },
    });
    const result = scoreContentCiteability(page);
    const issue = result.issues.find(
      (i) => i.code === "POOR_QUESTION_COVERAGE",
    );
    expect(issue).toBeUndefined();
  });

  // --- PDF_ONLY_CONTENT ---

  it("PDF_ONLY_CONTENT: deducts 5 when PDF links exist and wordCount < 300", () => {
    const page = makePage({ wordCount: 150 });
    page.extracted.pdf_links = ["https://example.com/doc.pdf"];
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "PDF_ONLY_CONTENT" }),
    );
  });

  it("PDF_ONLY_CONTENT: no deduction when wordCount >= 300", () => {
    const page = makePage({ wordCount: 500 });
    page.extracted.pdf_links = ["https://example.com/doc.pdf"];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "PDF_ONLY_CONTENT");
    expect(issue).toBeUndefined();
  });

  it("PDF_ONLY_CONTENT: no deduction when no PDF links", () => {
    const page = makePage({ wordCount: 150 });
    page.extracted.pdf_links = [];
    const result = scoreContentCiteability(page);
    const issue = result.issues.find((i) => i.code === "PDF_ONLY_CONTENT");
    expect(issue).toBeUndefined();
  });

  // --- STALE_CONTENT ---

  it("STALE_CONTENT: deducts 5 when staleContent flag is set", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        staleContent: true,
      } as PageData["siteContext"],
    });
    const result = scoreContentCiteability(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "STALE_CONTENT" }),
    );
  });

  // --- Edge cases ---

  it("handles no LLM scores gracefully (no LLM-based deductions)", () => {
    const page = makePage({ llmScores: null });
    const result = scoreContentCiteability(page);
    const llmIssues = result.issues.filter((i) =>
      [
        "CONTENT_DEPTH",
        "CONTENT_CLARITY",
        "CONTENT_AUTHORITY",
        "CITATION_WORTHINESS",
        "POOR_QUESTION_COVERAGE",
      ].includes(i.code),
    );
    expect(llmIssues).toHaveLength(0);
  });

  it("score never goes below 0 with many deductions", () => {
    const hashes = new Map<string, string>();
    hashes.set("abc123", "https://example.com/other-page");
    const page = makePage({
      wordCount: 100,
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: hashes,
        staleContent: true,
      } as PageData["siteContext"],
      llmScores: {
        comprehensiveness: 0, // -20
        clarity: 0, // -20
        authority: 0, // -20
        structure: 0, // -10 (POOR_QUESTION_COVERAGE)
        citation_worthiness: 0, // -20
      },
    });
    page.extracted.h1 = []; // -8 MISSING_H1
    page.extracted.internal_links = []; // -8 NO_INTERNAL_LINKS
    page.extracted.external_links = [];
    page.extracted.flesch_score = 20; // -6 POOR_READABILITY (very-difficult band)
    page.extracted.text_html_ratio = 5; // -8 LOW_TEXT_HTML_RATIO
    page.extracted.images_without_alt = 10; // -15 MISSING_ALT_TEXT (capped)
    page.extracted.sentence_length_variance = 5;
    page.extracted.top_transition_words = [
      "in conclusion",
      "moreover",
      "furthermore",
      "essentially",
    ]; // -10 AI_ASSISTANT_SPEAK
    page.extracted.pdf_links = ["https://example.com/doc.pdf"]; // -5 PDF_ONLY_CONTENT
    const result = scoreContentCiteability(page);
    // Total deductions far exceed 100, so score should be clamped to 0
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
