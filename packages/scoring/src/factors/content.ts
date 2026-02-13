import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";
import type { PageData, FactorResult } from "../types";

export function scoreContentFactors(page: PageData): FactorResult {
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

  // THIN_CONTENT: -15 if <200 words, -8 if 200-499
  if (page.wordCount < 200) {
    deduct("THIN_CONTENT", -15, { wordCount: page.wordCount });
  } else if (page.wordCount < 500) {
    deduct("THIN_CONTENT", -8, { wordCount: page.wordCount });
  }

  // LLM-based content scores: CONTENT_DEPTH, CONTENT_CLARITY, CONTENT_AUTHORITY
  // Map LLM scores (0-100) to 0-20 deduction range: deduction = -Math.round((100 - llmScore) * 0.2)
  if (page.llmScores) {
    // CONTENT_DEPTH — uses comprehensiveness
    const depthDeduction = -Math.round(
      (100 - page.llmScores.comprehensiveness) * 0.2,
    );
    if (depthDeduction < 0) {
      deduct("CONTENT_DEPTH", depthDeduction, {
        llmScore: page.llmScores.comprehensiveness,
      });
    }

    // CONTENT_CLARITY — uses clarity
    const clarityDeduction = -Math.round((100 - page.llmScores.clarity) * 0.2);
    if (clarityDeduction < 0) {
      deduct("CONTENT_CLARITY", clarityDeduction, {
        llmScore: page.llmScores.clarity,
      });
    }

    // CONTENT_AUTHORITY — uses authority
    const authorityDeduction = -Math.round(
      (100 - page.llmScores.authority) * 0.2,
    );
    if (authorityDeduction < 0) {
      deduct("CONTENT_AUTHORITY", authorityDeduction, {
        llmScore: page.llmScores.authority,
      });
    }
  }

  // DUPLICATE_CONTENT: -15 if contentHash matches another page in siteContext.contentHashes
  if (page.siteContext?.contentHashes) {
    const otherUrl = page.siteContext.contentHashes.get(page.contentHash);
    if (otherUrl && otherUrl !== page.url) {
      deduct("DUPLICATE_CONTENT", -15, { duplicateOf: otherUrl });
    }
  }

  // STALE_CONTENT: -5 (check via siteContext flag or other indicator)
  // For now, stale content is detected if siteContext includes a staleContent flag
  // This is a simplified check — in production it would compare last-modified dates
  if ((page.siteContext as Record<string, unknown> | undefined)?.staleContent) {
    deduct("STALE_CONTENT", -5);
  }

  // NO_INTERNAL_LINKS: -8 if fewer than 2 internal links
  if (page.extracted.internal_links.length < 2) {
    deduct("NO_INTERNAL_LINKS", -8, {
      internalLinkCount: page.extracted.internal_links.length,
    });
  }

  // EXCESSIVE_LINKS: -3 if external > internal * 3
  const internalCount = page.extracted.internal_links.length;
  const externalCount = page.extracted.external_links.length;
  if (internalCount > 0 && externalCount > internalCount * 3) {
    deduct("EXCESSIVE_LINKS", -3, { internalCount, externalCount });
  }

  // MISSING_FAQ_STRUCTURE: -5 if content has question patterns in headings but no Q&A format
  // Check for question-like headings (contains "?", starts with "How", "What", "Why", "When", "Where", "Which", "Who")
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
    deduct("MISSING_FAQ_STRUCTURE", -5);
  }

  return { score: Math.max(0, score), issues };
}
