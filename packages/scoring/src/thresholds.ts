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
  thinContentWords: 200,
  moderateContentWords: 500,
  minInternalLinks: 2,
  excessiveLinkRatio: 3,
  llmScoreDeductionScale: 0.2,
  aiAssistantSpeakMinCount: 3,
  sentenceLengthVarianceMin: 15,
  eeatMinWords: 500,
  fleschPoor: 50,
  fleschModerate: 60,
  textHtmlRatioMin: 15,

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
