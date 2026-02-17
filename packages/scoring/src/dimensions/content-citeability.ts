import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreContentCiteability(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // === From technical.ts ===

  // MISSING_H1
  if (page.extracted.h1.length === 0) {
    deduct(s, "MISSING_H1");
  }

  // MULTIPLE_H1
  if (page.extracted.h1.length > 1) {
    deduct(s, "MULTIPLE_H1", { h1Count: page.extracted.h1.length });
  }

  // HEADING_HIERARCHY - check for skipped levels
  const headingLevels: number[] = [];
  if (page.extracted.h1.length > 0) headingLevels.push(1);
  if (page.extracted.h2.length > 0) headingLevels.push(2);
  if (page.extracted.h3.length > 0) headingLevels.push(3);
  if (page.extracted.h4.length > 0) headingLevels.push(4);
  if (page.extracted.h5.length > 0) headingLevels.push(5);
  if (page.extracted.h6.length > 0) headingLevels.push(6);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      deduct(s, "HEADING_HIERARCHY", {
        skippedFrom: `H${headingLevels[i - 1]}`,
        skippedTo: `H${headingLevels[i]}`,
      });
      break;
    }
  }

  // MISSING_ALT_TEXT
  if (page.extracted.images_without_alt > 0) {
    const penalty = Math.min(
      page.extracted.images_without_alt * THRESHOLDS.altTextPenaltyPerImage,
      THRESHOLDS.altTextMaxPenalty,
    );
    deduct(s, "MISSING_ALT_TEXT", -penalty, {
      imagesWithoutAlt: page.extracted.images_without_alt,
    });
  }

  // === From content.ts (ALL content factors) ===

  // THIN_CONTENT: -15 if <200 words, -8 if 200-499
  if (page.wordCount < THRESHOLDS.thinContentWords) {
    deduct(
      s,
      "THIN_CONTENT",
      { wordCount: page.wordCount },
      undefined,
      `This page has only ${page.wordCount} words and isn't optimized for LLM citations. Try analyzing a full article or blog post instead (500+ words recommended).`,
    );
  } else if (page.wordCount < THRESHOLDS.moderateContentWords) {
    deduct(s, "THIN_CONTENT", -8, { wordCount: page.wordCount });
  }

  // LLM-based content scores: CONTENT_DEPTH, CONTENT_CLARITY, CONTENT_AUTHORITY
  if (page.llmScores) {
    const depthDeduction = -Math.round(
      (100 - page.llmScores.comprehensiveness) *
        THRESHOLDS.llmScoreDeductionScale,
    );
    if (depthDeduction < 0) {
      deduct(s, "CONTENT_DEPTH", depthDeduction, {
        llmScore: page.llmScores.comprehensiveness,
      });
    }

    const clarityDeduction = -Math.round(
      (100 - page.llmScores.clarity) * THRESHOLDS.llmScoreDeductionScale,
    );
    if (clarityDeduction < 0) {
      deduct(s, "CONTENT_CLARITY", clarityDeduction, {
        llmScore: page.llmScores.clarity,
      });
    }

    const authorityDeduction = -Math.round(
      (100 - page.llmScores.authority) * THRESHOLDS.llmScoreDeductionScale,
    );
    if (authorityDeduction < 0) {
      deduct(s, "CONTENT_AUTHORITY", authorityDeduction, {
        llmScore: page.llmScores.authority,
      });
    }
  }

  // DUPLICATE_CONTENT
  if (page.siteContext?.contentHashes) {
    const otherUrl = page.siteContext.contentHashes.get(page.contentHash);
    if (otherUrl && otherUrl !== page.url) {
      deduct(s, "DUPLICATE_CONTENT", { duplicateOf: otherUrl });
    }
  }

  // STALE_CONTENT
  if ((page.siteContext as Record<string, unknown> | undefined)?.staleContent) {
    deduct(s, "STALE_CONTENT");
  }

  // NO_INTERNAL_LINKS
  if (page.extracted.internal_links.length < THRESHOLDS.minInternalLinks) {
    deduct(s, "NO_INTERNAL_LINKS", {
      internalLinkCount: page.extracted.internal_links.length,
    });
  }

  // EXCESSIVE_LINKS
  const internalCount = page.extracted.internal_links.length;
  const externalCount = page.extracted.external_links.length;
  if (
    internalCount > 0 &&
    externalCount > internalCount * THRESHOLDS.excessiveLinkRatio
  ) {
    deduct(s, "EXCESSIVE_LINKS", { internalCount, externalCount });
  }

  // MISSING_FAQ_STRUCTURE
  const allHeadings = [
    ...page.extracted.h1,
    ...page.extracted.h2,
    ...page.extracted.h3,
    ...page.extracted.h4,
    ...page.extracted.h5,
    ...page.extracted.h6,
  ];
  const questionPattern =
    /^(how|what|why|when|where|which|who|can|does|is|should|will)\b/i;
  const hasQuestionHeadings = allHeadings.some(
    (h) => h.includes("?") || questionPattern.test(h),
  );
  const hasFaqSchema = page.extracted.schema_types.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  if (hasQuestionHeadings && !hasFaqSchema) {
    deduct(s, "MISSING_FAQ_STRUCTURE");
  }

  // POOR_READABILITY
  const flesch = page.extracted.flesch_score;
  if (flesch != null) {
    if (flesch < THRESHOLDS.fleschPoor) {
      deduct(s, "POOR_READABILITY", {
        fleschScore: flesch,
        classification: page.extracted.flesch_classification,
      });
    } else if (flesch < THRESHOLDS.fleschModerate) {
      deduct(s, "POOR_READABILITY", -5, {
        fleschScore: flesch,
        classification: page.extracted.flesch_classification,
      });
    }
  }

  // LOW_TEXT_HTML_RATIO
  const textRatio = page.extracted.text_html_ratio;
  if (textRatio != null && textRatio < THRESHOLDS.textHtmlRatioMin) {
    deduct(s, "LOW_TEXT_HTML_RATIO", {
      textHtmlRatio: Math.round(textRatio * 100) / 100,
    });
  }

  // AI_ASSISTANT_SPEAK
  const assistantWords = [
    "in conclusion",
    "moreover",
    "furthermore",
    "it is important to note",
    "it's important to note",
    "to summarize",
    "essentially",
    "ultimately",
  ];
  const detectedAssistantWords = (
    page.extracted.top_transition_words ?? []
  ).filter((w) => assistantWords.includes(w.toLowerCase()));
  if (detectedAssistantWords.length >= THRESHOLDS.aiAssistantSpeakMinCount) {
    deduct(s, "AI_ASSISTANT_SPEAK", {
      detectedWords: detectedAssistantWords,
    });
  }

  // UNIFORM_SENTENCE_LENGTH
  if (
    page.wordCount >= THRESHOLDS.thinContentWords &&
    page.extracted.sentence_length_variance != null &&
    page.extracted.sentence_length_variance <
      THRESHOLDS.sentenceLengthVarianceMin
  ) {
    deduct(s, "UNIFORM_SENTENCE_LENGTH", {
      variance: Math.round(page.extracted.sentence_length_variance * 100) / 100,
    });
  }

  // LOW_EEAT_SCORE
  const eeatMarkers = [
    /\b(I|me|my|mine|we|us|our)\b/i,
    /\b(experience|tested|verified|found|discovered)\b/i,
    /\b(case study|data set|analysis|research)\b/i,
  ];
  const hasEEAT = [...page.extracted.h1, ...page.extracted.h2].some((h) =>
    eeatMarkers.some((m) => m.test(h)),
  );

  if (!hasEEAT && page.wordCount >= THRESHOLDS.eeatMinWords) {
    deduct(s, "LOW_EEAT_SCORE");
  }

  // === From ai-readiness.ts ===

  // MISSING_AUTHORITATIVE_CITATIONS: -5 if no links to high-authority domains
  const authoritativeTlds = [".gov", ".edu", ".org"];
  const hasAuthCitation = page.extracted.external_links.some((link) =>
    authoritativeTlds.some((tld) => link.toLowerCase().includes(tld)),
  );
  if (
    !hasAuthCitation &&
    page.wordCount > THRESHOLDS.authoritativeCitationMinWords
  ) {
    deduct(s, "MISSING_AUTHORITATIVE_CITATIONS");
  }

  // CITATION_WORTHINESS: map from LLM scores (0-100 to 0-20 deduction)
  if (page.llmScores) {
    const citationDeduction = -Math.round(
      (100 - page.llmScores.citation_worthiness) *
        THRESHOLDS.llmScoreDeductionScale,
    );
    if (citationDeduction < 0) {
      deduct(s, "CITATION_WORTHINESS", citationDeduction, {
        llmScore: page.llmScores.citation_worthiness,
      });
    }
  }

  // NO_DIRECT_ANSWERS: -10 if content lacks direct answer patterns
  const allHeadingsForDirectAnswers = [
    ...page.extracted.h1,
    ...page.extracted.h2,
    ...page.extracted.h3,
  ];
  const hasQuestionHeadingsForDirectAnswers = allHeadingsForDirectAnswers.some(
    (h) => h.includes("?") || /^(how|what|why|when|where|which|who)\b/i.test(h),
  );
  const hasFaqSchemaForDirectAnswers = page.extracted.schema_types.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  if (
    page.wordCount >= THRESHOLDS.directAnswerMinWords &&
    hasQuestionHeadingsForDirectAnswers &&
    !hasFaqSchemaForDirectAnswers
  ) {
    deduct(s, "NO_DIRECT_ANSWERS");
  }

  // NO_SUMMARY_SECTION: -5 if page lacks a summary/key takeaway section
  const summaryPatterns =
    /\b(summary|key takeaways?|tl;?dr|conclusion|overview|highlights?|in brief)\b/i;
  const hasSummarySection = allHeadingsForDirectAnswers.some((h) =>
    summaryPatterns.test(h),
  );
  if (
    page.wordCount >= THRESHOLDS.summarySectionMinWords &&
    !hasSummarySection
  ) {
    deduct(s, "NO_SUMMARY_SECTION");
  }

  // POOR_QUESTION_COVERAGE: -10 if content doesn't address likely queries
  if (
    page.llmScores &&
    page.llmScores.structure < THRESHOLDS.structureScorePoor
  ) {
    deduct(s, "POOR_QUESTION_COVERAGE", {
      structureScore: page.llmScores.structure,
    });
  }

  // PDF_ONLY_CONTENT: -5 if page is thin but links to PDFs
  const pdfLinks = page.extracted.pdf_links ?? [];
  if (
    pdfLinks.length > 0 &&
    page.wordCount < THRESHOLDS.pdfOnlyContentMaxWords
  ) {
    deduct(s, "PDF_ONLY_CONTENT", {
      pdfCount: pdfLinks.length,
      wordCount: page.wordCount,
    });
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
