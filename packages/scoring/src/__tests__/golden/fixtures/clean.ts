import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * Clean, well-built pages that should score highly. These anchor the top of the
 * distribution — if a regression starts penalizing healthy pages, these move.
 */
export const cleanFixtures: GoldenFixture[] = [
  makeFixture(
    "clean-healthcare-article",
    "A well-structured families.care senior-care page: complete meta, schema, " +
      "internal links, an authoritative .gov citation, a summary section, and " +
      "short average sentence length. The canonical 'grade A, zero issues' page.",
    ["healthcare", "clean"],
    // No overrides — this IS the healthy base.
    {},
  ),

  makeFixture(
    "clean-generic-seo-guide",
    "A generic long-form SEO guide (blog Article with author + datePublished, " +
      "an authoritative .org citation, summary heading). Represents non-healthcare " +
      "content that should also score cleanly.",
    ["generic-seo", "clean"],
    {
      page: {
        url: "https://example.com/blog/technical-seo-guide",
        title: "The Complete Technical SEO Guide for 2026",
        metaDescription:
          "A practical, step-by-step technical SEO guide: crawlability, structured data, Core Web Vitals, and internal linking — with checklists you can apply today.",
        canonicalUrl: "https://example.com/blog/technical-seo-guide",
        wordCount: 1400,
      },
      extracted: {
        h1: ["The Complete Technical SEO Guide"],
        h2: ["Crawlability", "Structured Data", "Key Takeaways"],
        h3: ["Robots.txt", "XML Sitemaps"],
        schema_types: ["Article", "Organization"],
        internal_links: ["/blog", "/tools", "/pricing"],
        external_links: [
          "https://en.wikipedia.org/wiki/Search_engine_optimization",
        ],
        structured_data: [
          {
            "@type": "Article",
            headline: "The Complete Technical SEO Guide",
            author: { "@type": "Person", name: "Jordan Lee" },
            datePublished: "2026-01-15",
          },
          {
            "@type": "Organization",
            name: "Example Co",
            url: "https://example.com",
          },
        ],
        og_tags: {
          "og:title": "The Complete Technical SEO Guide",
          "og:description": "A practical, step-by-step technical SEO guide.",
          "og:image": "https://example.com/og/seo-guide.png",
        },
        avg_sentence_length: 15,
        flesch_score: 61,
        flesch_classification: "Standard",
      },
    },
  ),
];
