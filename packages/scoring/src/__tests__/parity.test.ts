import { describe, it, expect } from "vitest";
import { scorePage } from "../engine";
import { scorePageV2 } from "../engine-v2";
import type { PageData } from "../types";

// ---------------------------------------------------------------------------
// Test fixture helper
// ---------------------------------------------------------------------------

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title Here — Brand", // 30 chars (meets min 30)
    metaDescription:
      "A sufficiently long meta description that meets the minimum character requirement for SEO best practices and search engines.",
    canonicalUrl: "https://example.com/test",
    wordCount: 1000,
    contentHash: "abc123",
    extracted: {
      h1: ["Test Page"],
      h2: ["Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      internal_links: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ],
      external_links: ["https://other.com/a"],
      images_without_alt: 0,
      schema_types: [],
      structured_data: [],
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "https://example.com/img.jpg",
      },
      pdf_links: [],
      flesch_score: 65,
      flesch_classification: "standard",
      text_html_ratio: 25,
      top_transition_words: [],
      sentence_length_variance: 20,
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract sorted issue codes from a scoring result. */
function issueCodes(result: { issues: Array<{ code: string }> }): string[] {
  return result.issues.map((i) => i.code).sort();
}

/**
 * V2 may produce new issue codes that don't exist in V1 (e.g. LLMS_TXT_QUALITY,
 * LLMS_TXT_INCOMPLETE). For strict parity we only compare codes that both
 * engines are capable of emitting.
 */
const V2_ONLY_CODES = new Set(["LLMS_TXT_QUALITY", "LLMS_TXT_INCOMPLETE"]);

function issueCodesShared(result: {
  issues: Array<{ code: string }>;
}): string[] {
  return result.issues
    .map((i) => i.code)
    .filter((c) => !V2_ONLY_CODES.has(c))
    .sort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Parity: scorePage (v1) vs scorePageV2 (v2)", () => {
  // ---- 1. Clean page ----
  it("clean page — both engines produce high scores (> 80)", () => {
    const page = makePage();
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(v1.overallScore).toBeGreaterThan(80);
    expect(v2.overallScore).toBeGreaterThan(80);
  });

  // ---- 2. Error page (404) ----
  it("404 page — both return score 0 with HTTP_STATUS issue", () => {
    const page = makePage({ statusCode: 404 });
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(v1.overallScore).toBe(0);
    expect(v2.overallScore).toBe(0);
    expect(issueCodes(v1)).toEqual(["HTTP_STATUS"]);
    expect(issueCodes(v2)).toEqual(["HTTP_STATUS"]);
  });

  // ---- 3. Missing title ----
  it("missing title — both detect MISSING_TITLE", () => {
    const page = makePage({ title: null });
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(issueCodes(v1)).toContain("MISSING_TITLE");
    expect(issueCodes(v2)).toContain("MISSING_TITLE");
  });

  // ---- 4. Blocked AI crawlers ----
  it("blocked crawlers — both detect AI_CRAWLER_BLOCKED", () => {
    const page = makePage();
    page.siteContext = {
      ...page.siteContext!,
      aiCrawlersBlocked: ["GPTBot", "ClaudeBot"],
    };
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(issueCodes(v1)).toContain("AI_CRAWLER_BLOCKED");
    expect(issueCodes(v2)).toContain("AI_CRAWLER_BLOCKED");
  });

  // ---- 5. No structured data ----
  it("no structured data — both detect NO_STRUCTURED_DATA", () => {
    // Default fixture already has empty structured_data, so both should flag it
    const page = makePage();
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(issueCodes(v1)).toContain("NO_STRUCTURED_DATA");
    expect(issueCodes(v2)).toContain("NO_STRUCTURED_DATA");
  });

  // ---- 6. Thin content ----
  it("thin content — both detect THIN_CONTENT", () => {
    const page = makePage({ wordCount: 50 });
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(issueCodes(v1)).toContain("THIN_CONTENT");
    expect(issueCodes(v2)).toContain("THIN_CONTENT");
  });

  // ---- 7. Poor lighthouse ----
  it("poor lighthouse — both detect LH_PERF_LOW", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.3,
        seo: 0.95,
        accessibility: 0.88,
        best_practices: 0.92,
      },
    });
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(issueCodes(v1)).toContain("LH_PERF_LOW");
    expect(issueCodes(v2)).toContain("LH_PERF_LOW");
  });

  // ---- 8. Multiple issues — same codes detected ----
  it("page with multiple issues — same issue codes detected by both engines", () => {
    const page = makePage({
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      wordCount: 100,
      lighthouse: {
        performance: 0.3,
        seo: 0.5,
        accessibility: 0.5,
        best_practices: 0.5,
      },
    });
    page.extracted.h1 = [];
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    page.extracted.og_tags = undefined;
    page.extracted.internal_links = [];
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false,
      aiCrawlersBlocked: ["GPTBot"],
      hasSitemap: false,
    };

    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    const v1Codes = issueCodesShared(v1);
    const v2Codes = issueCodesShared(v2);

    expect(v1Codes).toEqual(v2Codes);
  });

  // ---- 9. Issue code parity across various scenarios ----
  describe("issue code parity", () => {
    const scenarios: Array<{ name: string; page: PageData }> = [
      {
        name: "clean page (default fixture)",
        page: makePage(),
      },
      {
        name: "missing meta description",
        page: makePage({ metaDescription: null }),
      },
      {
        name: "missing canonical",
        page: makePage({ canonicalUrl: null }),
      },
      {
        name: "noindex set",
        page: (() => {
          const p = makePage();
          p.extracted.has_robots_meta = true;
          p.extracted.robots_directives = ["noindex"];
          return p;
        })(),
      },
      {
        name: "images without alt text",
        page: (() => {
          const p = makePage();
          p.extracted.images_without_alt = 5;
          return p;
        })(),
      },
      {
        name: "missing sitemap",
        page: (() => {
          const p = makePage();
          p.siteContext = { ...p.siteContext!, hasSitemap: false };
          return p;
        })(),
      },
      {
        name: "missing llms.txt",
        page: (() => {
          const p = makePage();
          p.siteContext = { ...p.siteContext!, hasLlmsTxt: false };
          return p;
        })(),
      },
      {
        name: "all lighthouse scores low",
        page: makePage({
          lighthouse: {
            performance: 0.2,
            seo: 0.5,
            accessibility: 0.4,
            best_practices: 0.5,
          },
        }),
      },
    ];

    for (const { name, page } of scenarios) {
      it(`${name}: v1 and v2 detect the same issue codes`, () => {
        const v1 = scorePage(page);
        const v2 = scorePageV2(page);

        const v1Codes = issueCodesShared(v1);
        const v2Codes = issueCodesShared(v2);

        expect(v2Codes).toEqual(v1Codes);
      });
    }
  });

  // ---- 10. Score tolerance ----
  describe("score tolerance (within 15 points)", () => {
    const toleranceScenarios: Array<{ name: string; page: PageData }> = [
      { name: "clean page", page: makePage() },
      { name: "404 page", page: makePage({ statusCode: 404 }) },
      { name: "500 page", page: makePage({ statusCode: 500 }) },
      {
        name: "missing title",
        page: makePage({ title: null }),
      },
      {
        name: "thin content",
        page: makePage({ wordCount: 100 }),
      },
      {
        name: "poor lighthouse",
        page: makePage({
          lighthouse: {
            performance: 0.3,
            seo: 0.5,
            accessibility: 0.4,
            best_practices: 0.5,
          },
        }),
      },
      {
        name: "many issues combined",
        page: (() => {
          const p = makePage({
            title: null,
            metaDescription: null,
            wordCount: 100,
          });
          p.extracted.h1 = [];
          p.extracted.structured_data = [];
          p.extracted.schema_types = [];
          p.extracted.internal_links = [];
          p.siteContext = {
            ...p.siteContext!,
            hasLlmsTxt: false,
            aiCrawlersBlocked: ["GPTBot"],
          };
          return p;
        })(),
      },
    ];

    for (const { name, page } of toleranceScenarios) {
      it(`${name}: overall scores within 15 points`, () => {
        const v1 = scorePage(page);
        const v2 = scorePageV2(page);

        const diff = Math.abs(v1.overallScore - v2.overallScore);
        expect(diff).toBeLessThanOrEqual(15);
      });
    }
  });

  // ---- Additional structural checks ----

  it("both engines produce valid letter grades", () => {
    const page = makePage();
    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    const validGrades = ["A", "B", "C", "D", "F"];
    expect(validGrades).toContain(v1.letterGrade);
    expect(validGrades).toContain(v2.letterGrade);
  });

  it("both engines sort issues by severity (critical > warning > info)", () => {
    const page = makePage({
      title: null,
      canonicalUrl: null,
      wordCount: 100,
    });
    page.extracted.h1 = [];
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    page.extracted.internal_links = [];
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false,
      aiCrawlersBlocked: ["GPTBot"],
    };

    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    for (const result of [v1, v2]) {
      for (let i = 1; i < result.issues.length; i++) {
        expect(severityOrder[result.issues[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[result.issues[i - 1].severity],
        );
      }
    }
  });

  it("scores are clamped between 0 and 100 for both engines", () => {
    // Extreme case: many deductions
    const page = makePage({
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      wordCount: 50,
    });
    page.extracted.h1 = [];
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    page.extracted.images_without_alt = 10;
    page.extracted.og_tags = undefined;
    page.extracted.internal_links = [];
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    page.siteContext = {
      ...page.siteContext!,
      hasLlmsTxt: false,
      aiCrawlersBlocked: ["GPTBot", "ClaudeBot"],
      hasSitemap: false,
    };
    page.lighthouse = {
      performance: 0.1,
      seo: 0.1,
      accessibility: 0.1,
      best_practices: 0.1,
    };

    const v1 = scorePage(page);
    const v2 = scorePageV2(page);

    expect(v1.overallScore).toBeGreaterThanOrEqual(0);
    expect(v1.overallScore).toBeLessThanOrEqual(100);
    expect(v2.overallScore).toBeGreaterThanOrEqual(0);
    expect(v2.overallScore).toBeLessThanOrEqual(100);
  });
});
