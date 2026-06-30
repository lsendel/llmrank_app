import type { PageData, FactorResult } from "../types";
import { deduct, isAuthoritativeUrl, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";

// Schema.org types that carry authorship / expertise — a real E-E-A-T signal.
const EEAT_SCHEMA_TYPES = [
  "person",
  "article",
  "newsarticle",
  "blogposting",
  "scholarlyarticle",
  "techarticle",
  "report",
  "review",
  "recipe",
  "howto",
  "medicalwebpage",
  "aboutpage",
  "profilepage",
];

/**
 * True when the page carries a structured authorship/expertise signal: an
 * E-E-A-T schema type, or an explicit author/creator in its structured data.
 * Used to stop LOW_EEAT_SCORE from firing on legitimately-attributed content.
 */
function hasAuthorshipSignal(page: PageData): boolean {
  const types = page.extracted.schema_types.map((t) => t.toLowerCase());
  if (types.some((t) => EEAT_SCHEMA_TYPES.some((e) => t.includes(e)))) {
    return true;
  }
  const nodes = page.extracted.structured_data ?? [];
  return nodes.some(
    (n) => !!n && typeof n === "object" && ("author" in n || "creator" in n),
  );
}

/**
 * Apply every content-quality deduction to a score state. Shared by
 * scoreContentFactors (engine v1) and the content_citeability dimension
 * (engine v2) so the two engines cannot desync on content scoring.
 */
export function applyContentFactors(page: PageData, s: ScoreState): void {
  // THIN_CONTENT: tiered by word count. A near-empty stub is not citable by an
  // LLM, so it must lose far more than a borderline-thin page — the old flat -15
  // for anything <200 words scored a 30-word stub the same as a 199-word page.
  // <50: -40 (stub), 50-149: -22, 150-199: -15, 200-499: -8, 500+: none.
  const wc = page.wordCount;
  const thinMsg = `This page has only ${wc} words and isn't optimized for LLM citations. LLMs cite substantive, in-depth pages — aim for 500+ words of real content.`;
  if (wc < THRESHOLDS.stubContentWords) {
    deduct(s, "THIN_CONTENT", -40, { wordCount: wc }, thinMsg);
  } else if (wc < THRESHOLDS.veryThinContentWords) {
    deduct(s, "THIN_CONTENT", -22, { wordCount: wc }, thinMsg);
  } else if (wc < THRESHOLDS.thinContentWords) {
    deduct(s, "THIN_CONTENT", -15, { wordCount: wc }, thinMsg);
  } else if (wc < THRESHOLDS.moderateContentWords) {
    deduct(s, "THIN_CONTENT", -8, { wordCount: wc });
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
  // A page only "should" have FAQPage schema when it genuinely presents an
  // FAQ — i.e. multiple question-style headings (Q&A pairs). A single
  // rhetorical/section heading like "What is home care?" on an informational
  // or directory page does not warrant FAQ schema, so count the question
  // headings and require a real cluster before flagging.
  const questionHeadingCount = allHeadings.filter(
    (h) => h.includes("?") || questionPattern.test(h),
  ).length;
  const hasFaqSchema = page.extracted.schema_types.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  if (
    questionHeadingCount >= THRESHOLDS.faqMinQuestionHeadings &&
    !hasFaqSchema
  ) {
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
  // Only formulaic AI tells — NOT ordinary connectives. "moreover",
  // "furthermore", "however" etc. are everyday human prose and flagging them
  // penalised good writing (a top false-positive). These phrases are populated
  // by the crawler's transition-word extractor, so this list MUST stay in sync
  // with `assistant_words` in apps/crawler/src/crawler/parser.rs.
  const assistantWords = [
    "in conclusion",
    "it is important to note",
    "it's important to note",
    "it is worth noting",
    "it's worth noting",
    "to summarize",
    "in summary",
    "delve into",
    "a testament to",
    "in today's digital age",
    "in the realm of",
    "plays a crucial role",
    "plays a pivotal role",
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

  // LOW_EEAT_SCORE — does the page show ANY experience/expertise/authority
  // signal? The old check only scanned headings for first-person language,
  // which headings almost never contain, so it false-fired on nearly every
  // long page. Accept the signals that actually carry E-E-A-T: authorship
  // structured data and citations to authoritative sources, in addition to
  // experiential language in headings.
  const eeatMarkers = [
    /\b(I|me|my|mine|we|us|our)\b/i,
    /\b(experience|tested|verified|found|discovered)\b/i,
    /\b(case study|data set|analysis|research)\b/i,
  ];
  const eeatFromHeadings = [...page.extracted.h1, ...page.extracted.h2].some(
    (h) => eeatMarkers.some((m) => m.test(h)),
  );
  const hasEEAT =
    eeatFromHeadings ||
    hasAuthorshipSignal(page) ||
    page.extracted.external_links.some(isAuthoritativeUrl);

  if (!hasEEAT && page.wordCount >= THRESHOLDS.eeatMinWords) {
    deduct(s, "LOW_EEAT_SCORE");
  }
}

export function scoreContentFactors(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };
  applyContentFactors(page, s);
  return { score: Math.max(0, s.score), issues: s.issues };
}
