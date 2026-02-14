import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";

// Required properties for common schema types
const SCHEMA_REQUIRED_PROPS: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  WebPage: ["name", "description"],
  Organization: ["name", "url"],
  Product: ["name", "description"],
  FAQPage: ["mainEntity"],
  LocalBusiness: ["name", "address"],
};

export function scoreAiReadinessFactors(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_LLMS_TXT: -20 if siteContext.hasLlmsTxt is false
  if (page.siteContext && !page.siteContext.hasLlmsTxt) {
    deduct(s, "MISSING_LLMS_TXT", -20);
  }

  // AI_CRAWLER_BLOCKED: -25 if siteContext.aiCrawlersBlocked has entries
  if (page.siteContext && page.siteContext.aiCrawlersBlocked.length > 0) {
    deduct(s, "AI_CRAWLER_BLOCKED", -25, {
      blockedCrawlers: page.siteContext.aiCrawlersBlocked,
    });
  }

  // NO_STRUCTURED_DATA: -15 if no structured_data
  const structuredData = page.extracted.structured_data ?? [];
  if (structuredData.length === 0) {
    deduct(s, "NO_STRUCTURED_DATA", -15);
  }

  // INCOMPLETE_SCHEMA: -8 if schema exists but missing required props
  if (structuredData.length > 0) {
    for (const schema of structuredData) {
      const schemaObj = schema as Record<string, unknown>;
      const schemaType = schemaObj["@type"] as string | undefined;
      if (schemaType && SCHEMA_REQUIRED_PROPS[schemaType]) {
        const requiredProps = SCHEMA_REQUIRED_PROPS[schemaType];
        const missingProps = requiredProps.filter(
          (prop) => !(prop in schemaObj),
        );
        if (missingProps.length > 0) {
          deduct(s, "INCOMPLETE_SCHEMA", -8, {
            schemaType,
            missingProps,
          });
          break; // Only deduct once
        }
      }
    }
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
  const allHeadings = [
    ...page.extracted.h1,
    ...page.extracted.h2,
    ...page.extracted.h3,
  ];
  const hasQuestionHeadings = allHeadings.some(
    (h) => h.includes("?") || /^(how|what|why|when|where|which|who)\b/i.test(h),
  );
  const hasFaqSchema = page.extracted.schema_types.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  if (
    page.wordCount >= THRESHOLDS.directAnswerMinWords &&
    hasQuestionHeadings &&
    !hasFaqSchema
  ) {
    deduct(s, "NO_DIRECT_ANSWERS", -10);
  }

  // MISSING_ENTITY_MARKUP: -5 if key entities not in schema
  const entityTypes = ["Person", "Organization", "Product", "Place", "Event"];
  const hasEntityMarkup = page.extracted.schema_types.some((t) =>
    entityTypes.includes(t),
  );
  if (structuredData.length > 0 && !hasEntityMarkup) {
    deduct(s, "MISSING_ENTITY_MARKUP", -5);
  }

  // NO_SUMMARY_SECTION: -5 if page lacks a summary/key takeaway section
  const summaryPatterns =
    /\b(summary|key takeaways?|tl;?dr|conclusion|overview|highlights?|in brief)\b/i;
  const hasSummarySection = allHeadings.some((h) => summaryPatterns.test(h));
  if (
    page.wordCount >= THRESHOLDS.summarySectionMinWords &&
    !hasSummarySection
  ) {
    deduct(s, "NO_SUMMARY_SECTION", -5);
  }

  // POOR_QUESTION_COVERAGE: -10 if content doesn't address likely queries
  if (
    page.llmScores &&
    page.llmScores.structure < THRESHOLDS.structureScorePoor
  ) {
    deduct(s, "POOR_QUESTION_COVERAGE", -10, {
      structureScore: page.llmScores.structure,
    });
  }

  // INVALID_SCHEMA: -8 if structured data has parse errors
  if (structuredData.length > 0) {
    const hasInvalidSchema = structuredData.some((schema) => {
      const obj = schema as Record<string, unknown>;
      return !obj["@type"];
    });
    if (hasInvalidSchema) {
      deduct(s, "INVALID_SCHEMA", -8);
    }
  }

  // MISSING_AUTHORITATIVE_CITATIONS: -5 if no links to high-authority domains
  const authoritativeTlds = [".gov", ".edu", ".org"];
  const hasAuthCitation = page.extracted.external_links.some((link) =>
    authoritativeTlds.some((tld) => link.toLowerCase().includes(tld)),
  );
  if (
    !hasAuthCitation &&
    page.wordCount > THRESHOLDS.authoritativeCitationMinWords
  ) {
    deduct(s, "MISSING_AUTHORITATIVE_CITATIONS", -5);
  }

  // PDF_ONLY_CONTENT: -5 if page is thin but links to PDFs
  const pdfLinks = page.extracted.pdf_links ?? [];
  if (
    pdfLinks.length > 0 &&
    page.wordCount < THRESHOLDS.pdfOnlyContentMaxWords
  ) {
    deduct(s, "PDF_ONLY_CONTENT", -5, {
      pdfCount: pdfLinks.length,
      wordCount: page.wordCount,
    });
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
