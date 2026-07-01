import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * Readability fixtures — the regression lock for #112 / #116.
 *
 * POOR_READABILITY must be driven by STRUCTURE (average sentence length), NOT
 * vocabulary. A page of short, clinical, polysyllabic sentences must NOT be
 * flagged; a page of genuine run-on sentences MUST be. The Flesch fallback
 * (used only when avg_sentence_length is absent) is exercised too.
 */
export const readabilityFixtures: GoldenFixture[] = [
  makeFixture(
    "readability-clinical-short-sentences",
    "Technical/clinical healthcare prose: dense vocabulary → a very low Flesch " +
      "(32, 'Very Difficult'), but SHORT average sentences (13 words). MUST NOT " +
      "flag POOR_READABILITY — vocabulary difficulty is not a machine-extraction " +
      "problem. This is the core #112/#116 lock.",
    ["healthcare", "readability"],
    {
      page: { contentHash: "clinical-short-hash" },
      extracted: {
        avg_sentence_length: 13,
        flesch_score: 32,
        flesch_classification: "Very Difficult",
      },
    },
  ),

  makeFixture(
    "readability-run-on-sentences",
    "Genuine wall-of-text run-on prose: average sentence length 34 words " +
      "(> 30). SHOULD flag POOR_READABILITY at the heavy (-6) band regardless of " +
      "vocabulary — long sentences blow past an LLM's chunk boundaries.",
    ["generic-seo", "readability"],
    {
      page: { contentHash: "run-on-hash" },
      extracted: {
        avg_sentence_length: 34,
        flesch_score: 44,
        flesch_classification: "Difficult",
      },
    },
  ),

  makeFixture(
    "readability-long-sentences-mild",
    "Long-but-not-egregious prose: average sentence length 27 words (25-30). " +
      "Should flag POOR_READABILITY at the light (-3) nudge band.",
    ["generic-seo", "readability"],
    {
      page: { contentHash: "long-mild-hash" },
      extracted: {
        avg_sentence_length: 27,
        flesch_score: 48,
        flesch_classification: "Difficult",
      },
    },
  ),

  makeFixture(
    "readability-flesch-fallback-difficult",
    "Older crawl with NO avg_sentence_length: falls back to raw Flesch. A " +
      "'Difficult' Flesch (45, in 30-50) → light (-3) nudge via the fallback path.",
    ["generic-seo", "readability"],
    {
      page: { contentHash: "flesch-difficult-hash" },
      extracted: {
        avg_sentence_length: null,
        flesch_score: 45,
        flesch_classification: "Difficult",
      },
    },
  ),

  makeFixture(
    "readability-flesch-fallback-very-difficult",
    "Older crawl with NO avg_sentence_length and a 'Very Difficult' Flesch (25, " +
      "< 30) → heavier (-6) penalty via the fallback path.",
    ["generic-seo", "readability"],
    {
      page: { contentHash: "flesch-very-difficult-hash" },
      extracted: {
        avg_sentence_length: null,
        flesch_score: 25,
        flesch_classification: "Very Difficult",
      },
    },
  ),
];
