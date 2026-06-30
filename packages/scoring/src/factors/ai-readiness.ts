import type { PageData, FactorResult } from "../types";
import { deduct, isAuthoritativeUrl, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";
import {
  normalizeSchemaNodes,
  schemaTypesFromNodes,
  isEntityType,
} from "../schema-utils";
import { hasSummaryHeading } from "../summary-heading";

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
    deduct(s, "MISSING_LLMS_TXT");
  }

  // AI_CRAWLER_BLOCKED: -25 if siteContext.aiCrawlersBlocked has entries
  if (page.siteContext && page.siteContext.aiCrawlersBlocked.length > 0) {
    deduct(s, "AI_CRAWLER_BLOCKED", {
      blockedCrawlers: page.siteContext.aiCrawlersBlocked,
    });
  }

  // NO_STRUCTURED_DATA: -15 if no structured_data. Normalize first so @graph
  // wrappers and bare arrays expand into their actual typed nodes.
  const structuredData = page.extracted.structured_data ?? [];
  const schemaNodes = normalizeSchemaNodes(structuredData);
  // Merge crawler-reported types with types derived from the (normalized)
  // nodes so older crawl data that only stored the @graph wrapper still works.
  const schemaTypes = Array.from(
    new Set([
      ...page.extracted.schema_types,
      ...schemaTypesFromNodes(schemaNodes),
    ]),
  );
  if (schemaNodes.length === 0) {
    deduct(s, "NO_STRUCTURED_DATA");
  }

  // INCOMPLETE_SCHEMA: -8 if schema exists but missing required props
  if (schemaNodes.length > 0) {
    for (const schemaObj of schemaNodes) {
      const schemaType = schemaObj["@type"] as string | undefined;
      if (schemaType && SCHEMA_REQUIRED_PROPS[schemaType]) {
        const requiredProps = SCHEMA_REQUIRED_PROPS[schemaType];
        const missingProps = requiredProps.filter(
          (prop) => !(prop in schemaObj),
        );
        if (missingProps.length > 0) {
          deduct(s, "INCOMPLETE_SCHEMA", {
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
  const hasFaqSchema = schemaTypes.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  if (
    page.wordCount >= THRESHOLDS.directAnswerMinWords &&
    hasQuestionHeadings &&
    !hasFaqSchema
  ) {
    deduct(s, "NO_DIRECT_ANSWERS");
  }

  // MISSING_ENTITY_MARKUP: -5 if key entities not in schema. Recognizes
  // common entity subtypes (LocalBusiness, etc.), not just the bare bases.
  const hasEntityMarkup = schemaTypes.some(isEntityType);
  if (schemaNodes.length > 0 && !hasEntityMarkup) {
    deduct(s, "MISSING_ENTITY_MARKUP");
  }

  // NO_SUMMARY_SECTION: -5 if page lacks a summary/key-takeaway section
  // (multilingual — see hasSummaryHeading).
  if (
    page.wordCount >= THRESHOLDS.summarySectionMinWords &&
    !hasSummaryHeading(allHeadings)
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

  // INVALID_SCHEMA: -8 if any (normalized) node is missing its @type
  if (schemaNodes.length > 0) {
    const hasInvalidSchema = schemaNodes.some((node) => !node["@type"]);
    if (hasInvalidSchema) {
      deduct(s, "INVALID_SCHEMA");
    }
  }

  // MISSING_AUTHORITATIVE_CITATIONS: -5 if no links to high-authority domains.
  // Matches on the parsed hostname's TLD, not a substring of the whole URL.
  const hasAuthCitation =
    page.extracted.external_links.some(isAuthoritativeUrl);
  if (
    !hasAuthCitation &&
    page.wordCount > THRESHOLDS.authoritativeCitationMinWords
  ) {
    deduct(s, "MISSING_AUTHORITATIVE_CITATIONS");
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
