import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreContentFactors(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // THIN_CONTENT: -15 if <200 words, -8 if 200-499
  if (page.wordCount < THRESHOLDS.thinContentWords) {
    deduct(s, "THIN_CONTENT", -15, { wordCount: page.wordCount });
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
      deduct(s, "DUPLICATE_CONTENT", -15, { duplicateOf: otherUrl });
    }
  }

  // STALE_CONTENT
  if ((page.siteContext as Record<string, unknown> | undefined)?.staleContent) {
    deduct(s, "STALE_CONTENT", -5);
  }

  // NO_INTERNAL_LINKS
  if (page.extracted.internal_links.length < THRESHOLDS.minInternalLinks) {
    deduct(s, "NO_INTERNAL_LINKS", -8, {
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
    deduct(s, "EXCESSIVE_LINKS", -3, { internalCount, externalCount });
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
    deduct(s, "MISSING_FAQ_STRUCTURE", -5);
  }

  // POOR_READABILITY
  const flesch = page.extracted.flesch_score;
  if (flesch != null) {
    if (flesch < THRESHOLDS.fleschPoor) {
      deduct(s, "POOR_READABILITY", -10, {
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
    deduct(s, "LOW_TEXT_HTML_RATIO", -8, {
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
    deduct(s, "AI_ASSISTANT_SPEAK", -10, {
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
    deduct(s, "UNIFORM_SENTENCE_LENGTH", -5, {
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
    deduct(s, "LOW_EEAT_SCORE", -15);
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
