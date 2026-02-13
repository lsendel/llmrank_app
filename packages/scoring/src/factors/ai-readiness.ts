import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";
import type { PageData, FactorResult } from "../types";

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
  let score = 100;
  const issues: Issue[] = [];

  function deduct(
    code: string,
    amount: number,
    data?: Record<string, unknown>,
  ) {
    const def = ISSUE_DEFINITIONS[code];
    if (!def) return;
    score = Math.max(0, score + amount); // amount is negative
    issues.push({
      code: def.code,
      category: def.category,
      severity: def.severity,
      message: def.message,
      recommendation: def.recommendation,
      data,
    });
  }

  // MISSING_LLMS_TXT: -20 if siteContext.hasLlmsTxt is false
  if (page.siteContext && !page.siteContext.hasLlmsTxt) {
    deduct("MISSING_LLMS_TXT", -20);
  }

  // AI_CRAWLER_BLOCKED: -25 if siteContext.aiCrawlersBlocked has entries
  if (page.siteContext && page.siteContext.aiCrawlersBlocked.length > 0) {
    deduct("AI_CRAWLER_BLOCKED", -25, {
      blockedCrawlers: page.siteContext.aiCrawlersBlocked,
    });
  }

  // NO_STRUCTURED_DATA: -15 if no structured_data
  const structuredData = page.extracted.structured_data ?? [];
  if (structuredData.length === 0) {
    deduct("NO_STRUCTURED_DATA", -15);
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
          deduct("INCOMPLETE_SCHEMA", -8, {
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
      (100 - page.llmScores.citation_worthiness) * 0.2,
    );
    if (citationDeduction < 0) {
      deduct("CITATION_WORTHINESS", citationDeduction, {
        llmScore: page.llmScores.citation_worthiness,
      });
    }
  }

  // NO_DIRECT_ANSWERS: -10 if content lacks direct answer patterns
  // Check for summary/answer patterns: short paragraphs after question headings,
  // or sentences that start with definitional patterns
  const allHeadings = [
    ...page.extracted.h1,
    ...page.extracted.h2,
    ...page.extracted.h3,
  ];
  const hasQuestionHeadings = allHeadings.some(
    (h) => h.includes("?") || /^(how|what|why|when|where|which|who)\b/i.test(h),
  );
  // If there are question headings but no FAQ schema, and no structured Q&A, flag it
  const hasFaqSchema = page.extracted.schema_types.some(
    (t) => t.toLowerCase() === "faqpage" || t.toLowerCase() === "qapage",
  );
  // Also check if wordCount is sufficient (thin pages can't have direct answers)
  if (page.wordCount >= 200 && hasQuestionHeadings && !hasFaqSchema) {
    deduct("NO_DIRECT_ANSWERS", -10);
  }

  // MISSING_ENTITY_MARKUP: -5 if key entities not in schema
  // Check if schema has Person, Organization, or Product types
  const entityTypes = ["Person", "Organization", "Product", "Place", "Event"];
  const hasEntityMarkup = page.extracted.schema_types.some((t) =>
    entityTypes.includes(t),
  );
  if (structuredData.length > 0 && !hasEntityMarkup) {
    deduct("MISSING_ENTITY_MARKUP", -5);
  }

  // NO_SUMMARY_SECTION: -5 if page lacks a summary/key takeaway section
  // Check headings for summary patterns
  const summaryPatterns =
    /\b(summary|key takeaways?|tl;?dr|conclusion|overview|highlights?|in brief)\b/i;
  const hasSummarySection = allHeadings.some((h) => summaryPatterns.test(h));
  if (page.wordCount >= 500 && !hasSummarySection) {
    deduct("NO_SUMMARY_SECTION", -5);
  }

  // POOR_QUESTION_COVERAGE: -10 if content doesn't address likely queries
  // Use LLM structure score as a proxy: low structure = poor question coverage
  if (page.llmScores && page.llmScores.structure < 50) {
    deduct("POOR_QUESTION_COVERAGE", -10, {
      structureScore: page.llmScores.structure,
    });
  }

  // INVALID_SCHEMA: -8 if structured data has parse errors
  // Check for schemas that lack @type (likely malformed)
  if (structuredData.length > 0) {
    const hasInvalidSchema = structuredData.some((schema) => {
      const obj = schema as Record<string, unknown>;
      return !obj["@type"];
    });
    if (hasInvalidSchema) {
      deduct("INVALID_SCHEMA", -8);
    }
  }

  return { score: Math.max(0, score), issues };
}
