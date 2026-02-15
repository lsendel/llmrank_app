import { describe, it, expect } from "vitest";
import { THRESHOLDS } from "../thresholds";

describe("THRESHOLDS", () => {
  it("has all expected top-level keys", () => {
    const expectedKeys = [
      "title",
      "metaDesc",
      "httpErrorStatus",
      "altTextPenaltyPerImage",
      "altTextMaxPenalty",
      "slowResponseMs",
      "sitemapCoverageMin",
      "redirectChainMaxHops",
      "thinContentWords",
      "moderateContentWords",
      "minInternalLinks",
      "excessiveLinkRatio",
      "llmScoreDeductionScale",
      "directAnswerMinWords",
      "summarySectionMinWords",
      "structureScorePoor",
      "lighthouse",
      "largePageSizeBytes",
    ];

    for (const key of expectedKeys) {
      expect(THRESHOLDS).toHaveProperty(key);
    }
  });

  it("has reasonable numeric threshold values", () => {
    // Title length bounds
    expect(THRESHOLDS.title.min).toBeLessThan(THRESHOLDS.title.max);
    expect(THRESHOLDS.title.min).toBeGreaterThan(0);

    // Meta desc length bounds
    expect(THRESHOLDS.metaDesc.min).toBeLessThan(THRESHOLDS.metaDesc.max);
    expect(THRESHOLDS.metaDesc.min).toBeGreaterThan(0);

    // Content word counts
    expect(THRESHOLDS.thinContentWords).toBeLessThan(
      THRESHOLDS.moderateContentWords,
    );

    // Lighthouse thresholds between 0 and 1
    expect(THRESHOLDS.lighthouse.perfLow).toBeGreaterThan(0);
    expect(THRESHOLDS.lighthouse.perfLow).toBeLessThan(1);
    expect(THRESHOLDS.lighthouse.perfModerate).toBeGreaterThan(
      THRESHOLDS.lighthouse.perfLow,
    );

    // HTTP error status
    expect(THRESHOLDS.httpErrorStatus).toBe(400);

    // Page size is positive
    expect(THRESHOLDS.largePageSizeBytes).toBeGreaterThan(0);
  });

  it("lighthouse thresholds are all between 0 and 1", () => {
    const lhValues = Object.values(THRESHOLDS.lighthouse);
    for (const val of lhValues) {
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});
