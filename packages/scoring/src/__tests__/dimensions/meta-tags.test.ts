import { describe, it, expect } from "vitest";
import { scoreMetaTags } from "../../dimensions/meta-tags";
import type { PageData } from "../../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
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
      h2: ["Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
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
      structured_data: [],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 20,
      top_transition_words: [],
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

describe("scoreMetaTags", () => {
  it("returns 100 for a page with all meta tags correct", () => {
    const result = scoreMetaTags(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- MISSING_TITLE ---

  it("MISSING_TITLE: deducts 15 for null title", () => {
    const result = scoreMetaTags(makePage({ title: null }));
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_TITLE", severity: "critical" }),
    );
  });

  it("TITLE_LENGTH (not MISSING_TITLE): present title shorter than 30 chars is a warning", () => {
    const result = scoreMetaTags(makePage({ title: "Short" }));
    expect(result.score).toBe(95); // -5 warning, not -15 critical
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "TITLE_LENGTH", severity: "warning" }),
    );
    expect(
      result.issues.find((i) => i.code === "MISSING_TITLE"),
    ).toBeUndefined();
  });

  it("TITLE_LENGTH (not MISSING_TITLE): present title longer than 60 chars is a warning", () => {
    const result = scoreMetaTags(
      makePage({
        title:
          "This is a very long title that exceeds the sixty character maximum for good SEO practice",
      }),
    );
    expect(result.score).toBe(95); // -5 warning, not -15 critical
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "TITLE_LENGTH" }),
    );
    expect(
      result.issues.find((i) => i.code === "MISSING_TITLE"),
    ).toBeUndefined();
  });

  it("MISSING_TITLE: includes titleLength 0 in data", () => {
    const result = scoreMetaTags(makePage({ title: null }));
    const issue = result.issues.find((i) => i.code === "MISSING_TITLE");
    expect(issue?.data).toEqual({ titleLength: 0 });
  });

  it("MISSING_TITLE / TITLE_LENGTH: passes for title within range", () => {
    const result = scoreMetaTags(
      makePage({ title: "Exactly Thirty Characters Here!" }), // 31 chars
    );
    expect(
      result.issues.find(
        (i) => i.code === "MISSING_TITLE" || i.code === "TITLE_LENGTH",
      ),
    ).toBeUndefined();
  });

  // --- MISSING_META_DESC ---

  it("MISSING_META_DESC: deducts 10 for null meta description", () => {
    const result = scoreMetaTags(makePage({ metaDescription: null }));
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_META_DESC" }),
    );
  });

  it("META_DESC_LENGTH (not MISSING_META_DESC): present description shorter than 120 chars is info", () => {
    const result = scoreMetaTags(
      makePage({ metaDescription: "Too short description." }),
    );
    expect(result.score).toBe(97); // -3 info, not -10 warning
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "META_DESC_LENGTH", severity: "info" }),
    );
    expect(
      result.issues.find((i) => i.code === "MISSING_META_DESC"),
    ).toBeUndefined();
  });

  it("META_DESC_LENGTH (not MISSING_META_DESC): present description longer than 160 chars is info", () => {
    const result = scoreMetaTags(
      makePage({ metaDescription: "A".repeat(161) }),
    );
    expect(result.score).toBe(97); // -3 info
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "META_DESC_LENGTH" }),
    );
  });

  it("MISSING_META_DESC: includes descLength in data", () => {
    const result = scoreMetaTags(makePage({ metaDescription: null }));
    const issue = result.issues.find((i) => i.code === "MISSING_META_DESC");
    expect(issue?.data).toEqual({ descLength: 0 });
  });

  // --- MISSING_OG_TAGS ---

  it("MISSING_OG_TAGS: deducts 5 when og:title is missing", () => {
    const page = makePage();
    page.extracted.og_tags = {
      "og:description": "Desc",
      "og:image": "/img.png",
    };
    const result = scoreMetaTags(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_OG_TAGS", severity: "info" }),
    );
  });

  it("MISSING_OG_TAGS: deducts 5 when og:description is missing", () => {
    const page = makePage();
    page.extracted.og_tags = { "og:title": "Test", "og:image": "/img.png" };
    const result = scoreMetaTags(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_OG_TAGS" }),
    );
  });

  it("MISSING_OG_TAGS: deducts 5 when og:image is missing", () => {
    const page = makePage();
    page.extracted.og_tags = { "og:title": "Test", "og:description": "Desc" };
    const result = scoreMetaTags(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_OG_TAGS" }),
    );
  });

  it("MISSING_OG_TAGS: deducts 5 when og_tags is undefined", () => {
    const page = makePage();
    page.extracted.og_tags = undefined;
    const result = scoreMetaTags(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_OG_TAGS" }),
    );
  });

  it("MISSING_OG_TAGS: no deduction when all three og tags present", () => {
    const result = scoreMetaTags(makePage());
    const issue = result.issues.find((i) => i.code === "MISSING_OG_TAGS");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_CANONICAL ---

  it("MISSING_CANONICAL: deducts 8 for missing canonical URL", () => {
    const result = scoreMetaTags(makePage({ canonicalUrl: null }));
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_CANONICAL" }),
    );
  });

  it("MISSING_CANONICAL: no deduction when canonical URL is present", () => {
    const result = scoreMetaTags(makePage());
    const issue = result.issues.find((i) => i.code === "MISSING_CANONICAL");
    expect(issue).toBeUndefined();
  });

  // --- Multiple issues ---

  it("accumulates deductions from all 4 meta tag issues", () => {
    const page = makePage({
      title: null, // -15
      metaDescription: null, // -10
      canonicalUrl: null, // -8
    });
    page.extracted.og_tags = undefined; // -5
    const result = scoreMetaTags(page);
    expect(result.score).toBe(62); // 100 - 15 - 10 - 5 - 8
    expect(result.issues).toHaveLength(4);
  });

  it("score never goes below 0", () => {
    const page = makePage({
      title: null,
      metaDescription: null,
      canonicalUrl: null,
    });
    page.extracted.og_tags = undefined;
    const result = scoreMetaTags(page);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
