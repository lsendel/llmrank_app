import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * Content-quality edge cases: thin content tiers, nav-heavy marketing, and
 * duplicate content. Each isolates one content factor against the healthy base.
 */
export const contentQualityFixtures: GoldenFixture[] = [
  makeFixture(
    "thin-content-stub",
    "A 30-word stub (e.g. a bare contact page). Should take the heaviest " +
      "THIN_CONTENT deduction (stub tier, <50 words).",
    ["generic-seo", "edge"],
    {
      page: { wordCount: 30, contentHash: "thin-stub-hash" },
      extracted: { h1: ["Contact Us"], h2: [], h3: [] },
    },
  ),

  makeFixture(
    "thin-content-borderline",
    "A 180-word page — thin but not a stub. Locks the mid THIN_CONTENT tier " +
      "(150-199 words) so it is not scored the same as a 30-word stub.",
    ["generic-seo", "edge"],
    {
      page: { wordCount: 180, contentHash: "thin-borderline-hash" },
      extracted: { h2: ["Overview"], h3: [] },
    },
  ),

  makeFixture(
    "nav-heavy-marketing",
    "A nav/link-heavy marketing page: little real copy, a low text-to-HTML " +
      "ratio, far more external than internal links, and no structured data. " +
      "Should flag EXCESSIVE_LINKS, LOW_TEXT_HTML_RATIO, and NO_STRUCTURED_DATA.",
    ["generic-seo", "edge"],
    {
      page: { wordCount: 260, contentHash: "nav-heavy-hash" },
      extracted: {
        h1: ["Solutions"],
        h2: ["Products", "Partners"],
        h3: [],
        internal_links: ["/a", "/b"],
        external_links: [
          "https://partner1.com",
          "https://partner2.com",
          "https://partner3.com",
          "https://partner4.com",
          "https://partner5.com",
          "https://partner6.com",
          "https://partner7.com",
          "https://partner8.com",
          "https://partner9.com",
          "https://partner10.com",
        ],
        schema_types: [],
        structured_data: [],
        text_html_ratio: 9,
        avg_sentence_length: 14,
      },
    },
  ),

  makeFixture(
    "duplicate-content",
    "A page whose content hash matches another already-seen URL on the site. " +
      "Should flag DUPLICATE_CONTENT and nothing else.",
    ["generic-seo", "edge"],
    {
      page: { contentHash: "shared-dup-hash" },
      siteContext: {
        contentHashes: new Map([
          ["shared-dup-hash", "https://families.care/services/home-care"],
        ]),
      },
    },
  ),
];
