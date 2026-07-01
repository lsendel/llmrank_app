import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * Technical / AI-readiness structural fixtures. Each isolates one critical or
 * high-value factor (missing title, missing schema, missing llms.txt, noindex,
 * AI crawler blocked, FAQ handling, alt text, sitemap) against the healthy base.
 */
export const technicalSeoFixtures: GoldenFixture[] = [
  makeFixture(
    "missing-title",
    "Page with no <title>. Should flag the critical MISSING_TITLE.",
    ["generic-seo", "edge"],
    { page: { title: null, contentHash: "missing-title-hash" } },
  ),

  makeFixture(
    "missing-structured-data",
    "Page with no JSON-LD structured data. Should flag NO_STRUCTURED_DATA.",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "missing-schema-hash" },
      extracted: { schema_types: [], structured_data: [] },
    },
  ),

  makeFixture(
    "missing-llms-txt",
    "Site has no llms.txt. Should flag the critical MISSING_LLMS_TXT.",
    ["healthcare", "edge"],
    {
      page: { contentHash: "missing-llms-hash" },
      siteContext: { hasLlmsTxt: false },
    },
  ),

  makeFixture(
    "noindex-set",
    "Page sets robots noindex — it will be excluded from AI indexes. Should " +
      "flag the critical NOINDEX_SET.",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "noindex-hash" },
      extracted: { has_robots_meta: true, robots_directives: ["noindex"] },
    },
  ),

  makeFixture(
    "ai-crawler-blocked",
    "robots.txt blocks GPTBot and ClaudeBot. Should flag the critical " +
      "AI_CRAWLER_BLOCKED.",
    ["healthcare", "edge"],
    {
      page: { contentHash: "ai-blocked-hash" },
      siteContext: { aiCrawlersBlocked: ["GPTBot", "ClaudeBot"] },
    },
  ),

  makeFixture(
    "faq-missing-schema",
    "A page with 3+ question-style headings but no FAQPage schema. Should flag " +
      "MISSING_FAQ_STRUCTURE (content) and NO_DIRECT_ANSWERS (AI readiness).",
    ["healthcare", "edge"],
    {
      page: { contentHash: "faq-missing-hash" },
      extracted: {
        h2: [
          "How much does home care cost?",
          "What is skilled nursing?",
          "When should I hire a caregiver?",
          "Key Takeaways",
        ],
        h3: [],
      },
    },
  ),

  makeFixture(
    "faq-proper",
    "A proper FAQ page: 3+ question headings AND FAQPage schema (plus an " +
      "Organization entity). Should NOT flag MISSING_FAQ_STRUCTURE or " +
      "NO_DIRECT_ANSWERS — locks the FAQ-detection intent.",
    ["healthcare", "clean"],
    {
      page: { contentHash: "faq-proper-hash" },
      extracted: {
        h2: [
          "How much does home care cost?",
          "What is skilled nursing?",
          "When should I hire a caregiver?",
          "Key Takeaways",
        ],
        h3: [],
        schema_types: ["WebPage", "Organization", "FAQPage"],
        structured_data: [
          { "@type": "WebPage", name: "Home Care FAQ", description: "…" },
          {
            "@type": "Organization",
            name: "Families Care",
            url: "https://families.care",
          },
          {
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "How much does home care cost?" },
            ],
          },
        ],
      },
    },
  ),

  makeFixture(
    "images-missing-alt",
    "Page with 6 images missing alt text. Should flag MISSING_ALT_TEXT " +
      "(capped penalty).",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "images-alt-hash" },
      extracted: { images_without_alt: 6 },
    },
  ),

  makeFixture(
    "missing-sitemap",
    "Site has no sitemap. Should flag MISSING_SITEMAP.",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "no-sitemap-hash" },
      siteContext: { hasSitemap: false },
    },
  ),
];
