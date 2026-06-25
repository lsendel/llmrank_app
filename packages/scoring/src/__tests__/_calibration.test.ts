import { describe, it, expect } from "vitest";
import { scorePage } from "../engine";
import type { PageData } from "../types";

// Calibration regression test: runs the full engine on representative pages and
// asserts the scores discriminate quality (better page => higher score, and a
// near-empty page is a failing grade). Guards against the thin-content engine
// regressing to where a 0-word stub scored the same as a real article.
function base(): PageData {
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
      h1: ["Main Heading - My Experience"],
      h2: ["Section 1: Our Tests", "Section 2: Research Findings"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage", "Article"],
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
  };
}

function variant(
  o: Partial<PageData>,
  e: Partial<PageData["extracted"]> = {},
): PageData {
  const b = base();
  return { ...b, ...o, extracted: { ...b.extracted, ...e } };
}

const CASES: Record<string, PageData> = {
  "perfect (800w, full structure)": base(),
  "decent (600w, basic structure)": variant(
    {
      wordCount: 600,
      metaDescription:
        "A reasonable meta description for a decent blog post about a real topic that people search.",
    },
    { h2: ["Intro"], schema_types: ["WebPage"], external_links: [] },
  ),
  "example.com (30w, short title, no meta/llms)": variant(
    { title: "Example Domain", metaDescription: null, wordCount: 30 },
    {
      h1: ["Example Domain"],
      h2: [],
      h3: [],
      schema_types: [],
      internal_links: [],
      external_links: ["https://www.iana.org/domains/example"],
      structured_data: [],
      og_tags: {},
      top_transition_words: [],
    },
  ),
  "near-empty (0w, no title/meta/h1/schema/llms)": variant(
    {
      title: "",
      metaDescription: null,
      wordCount: 0,
      siteContext: {
        hasLlmsTxt: false,
        aiCrawlersBlocked: [],
        hasSitemap: false,
        contentHashes: new Map(),
      },
      lighthouse: {
        performance: 0.5,
        seo: 0.4,
        accessibility: 0.5,
        best_practices: 0.5,
      },
    },
    {
      h1: [],
      h2: [],
      h3: [],
      schema_types: [],
      internal_links: [],
      external_links: [],
      structured_data: [],
      og_tags: {},
      top_transition_words: [],
    },
  ),
};

describe("CALIBRATION", () => {
  const r = Object.fromEntries(
    Object.entries(CASES).map(([name, page]) => [name, scorePage(page)]),
  );
  const perfect = r["perfect (800w, full structure)"];
  const decent = r["decent (600w, basic structure)"];
  const thin = r["example.com (30w, short title, no meta/llms)"];
  const empty = r["near-empty (0w, no title/meta/h1/schema/llms)"];

  it("prints the calibration matrix", () => {
    const rows = ["case".padEnd(46) + " ovr grd cont"];
    for (const [name, x] of Object.entries(r)) {
      rows.push(
        name.padEnd(46) +
          ` ${String(x.overallScore).padStart(3)}  ${x.letterGrade}  ${String(x.contentScore).padStart(3)}`,
      );
    }
    console.log("\n" + rows.join("\n") + "\n");
  });

  it("scores increase monotonically with page quality", () => {
    expect(perfect.overallScore).toBeGreaterThanOrEqual(decent.overallScore);
    expect(decent.overallScore).toBeGreaterThan(thin.overallScore);
    expect(thin.overallScore).toBeGreaterThan(empty.overallScore);
  });

  it("a well-built page is an A and a near-empty page is an F", () => {
    expect(perfect.overallScore).toBeGreaterThanOrEqual(90);
    expect(empty.overallScore).toBeLessThan(60);
    expect(empty.letterGrade).toBe("F");
  });

  it("thin/stub pages are penalized on content (not near-perfect)", () => {
    expect(perfect.contentScore).toBe(100);
    expect(thin.contentScore).toBeLessThan(70);
    expect(empty.contentScore).toBeLessThan(70);
  });
});
