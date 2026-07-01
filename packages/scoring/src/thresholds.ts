/** Tunable scoring thresholds used by factor modules. */

export const THRESHOLDS = {
  // --- Technical ---
  title: { min: 30, max: 60 },
  metaDesc: { min: 120, max: 160 },
  httpErrorStatus: 400,
  altTextPenaltyPerImage: 3,
  altTextMaxPenalty: 15,
  slowResponseMs: 2000,
  sitemapCoverageMin: 0.5,
  redirectChainMaxHops: 3,

  // --- Content ---
  stubContentWords: 50, // below this a page is essentially un-citable
  veryThinContentWords: 150,
  thinContentWords: 200,
  moderateContentWords: 500,
  minInternalLinks: 2,
  excessiveLinkRatio: 3,
  llmScoreDeductionScale: 0.2,
  aiAssistantSpeakMinCount: 3,
  // Below this sentence-length variance, prose reads as robotically uniform.
  // Tightened from 15 → 8 so only genuinely monotonous content trips it;
  // ordinary varied writing sits comfortably above 8 (a top false-positive).
  sentenceLengthVarianceMin: 8,
  eeatMinWords: 500,
  // POOR_READABILITY targets STRUCTURAL unreadability — long/run-on sentences
  // and wall-of-text prose, which is what actually hurts an LLM's ability to
  // chunk and extract a page — NOT vocabulary difficulty, which LLMs handle
  // fine.
  //
  // PRIMARY signal: AVERAGE SENTENCE LENGTH (words / sentences), emitted by the
  // crawler (readability.rs). This is the pure structural component — it carries
  // no syllable/vocabulary term at all. Research on readability consistently
  // puts the "difficult" bar around 20-25 words/sentence and "hard/very hard"
  // above ~30; we take a deliberately conservative 25 (well clear of the 15-20
  // that ordinary good prose averages, so it never false-fires on normal
  // writing) for a light nudge, and 30 for the real penalty. Long sentences are
  // exactly what blows past an LLM's chunk boundaries and dilutes the
  // subject-predicate signal, so this is the right thing to penalise.
  avgSentenceLengthPoor: 25, // > this ("difficult"): long avg sentences → light -3 nudge
  avgSentenceLengthVeryPoor: 30, // > this ("hard"): run-on / wall-of-text → -6
  //
  // FALLBACK signal: raw Flesch reading-ease, used ONLY when avg_sentence_length
  // is absent (historical crawls + the deploy window before the crawler field is
  // live). Flesch conflates structure and vocabulary: its `-84.6*syllables/word`
  // term penalises polysyllabic technical/clinical vocabulary ("rehabilitation",
  // "assisted living facility") that is not a comprehension barrier for machines,
  // so well-written healthcare/legal/scientific prose scores far below the
  // classic 60+ "plain English" bar. We therefore treat it as a NOISY proxy for
  // structure: only the genuinely-difficult bands are penalised, the bar is
  // dropped from 60 to 50, and the severity is roughly halved (see content.ts).
  fleschVeryPoor: 30, // "Very Difficult": dense AND long-sentenced → real penalty
  fleschPoor: 50, // "Difficult": light nudge only; Flesch >= 50 is unpenalised
  textHtmlRatioMin: 15,
  // A genuine FAQ section (worth FAQPage schema) has several Q&A pairs. A
  // single question-style heading on an informational/directory page does not
  // warrant FAQ schema, so only flag MISSING_FAQ_STRUCTURE at/above this count.
  faqMinQuestionHeadings: 3,

  // --- AI Readiness ---
  directAnswerMinWords: 200,
  summarySectionMinWords: 500,
  structureScorePoor: 50,
  authoritativeCitationMinWords: 300,
  pdfOnlyContentMaxWords: 300,

  // --- Performance ---
  lighthouse: {
    perfLow: 0.5,
    perfModerate: 0.8,
    seoLow: 0.8,
    a11yLow: 0.7,
    bestPracticesLow: 0.8,
  },
  largePageSizeBytes: 3 * 1024 * 1024,
} as const;
