import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { applyContentFactors } from "../factors/content";
import { THRESHOLDS } from "../thresholds";
import { hasSummaryHeading } from "../summary-heading";

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

  // === Content factors (shared with engine v1 via applyContentFactors) ===
  applyContentFactors(page, s);

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

  // NO_SUMMARY_SECTION: -5 if page lacks a summary/key-takeaway section
  // (multilingual — see hasSummaryHeading).
  if (
    page.wordCount >= THRESHOLDS.summarySectionMinWords &&
    !hasSummaryHeading(allHeadingsForDirectAnswers)
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
