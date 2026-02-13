import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";
import type { PageData, FactorResult } from "../types";

export function scoreTechnicalFactors(page: PageData): FactorResult {
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

  // MISSING_TITLE
  if (!page.title || page.title.length < 30 || page.title.length > 60) {
    deduct("MISSING_TITLE", -15, { titleLength: page.title?.length ?? 0 });
  }

  // MISSING_META_DESC
  if (
    !page.metaDescription ||
    page.metaDescription.length < 120 ||
    page.metaDescription.length > 160
  ) {
    deduct("MISSING_META_DESC", -10, {
      descLength: page.metaDescription?.length ?? 0,
    });
  }

  // MISSING_H1
  if (page.extracted.h1.length === 0) {
    deduct("MISSING_H1", -8);
  }

  // MULTIPLE_H1
  if (page.extracted.h1.length > 1) {
    deduct("MULTIPLE_H1", -5, { h1Count: page.extracted.h1.length });
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
      deduct("HEADING_HIERARCHY", -3, {
        skippedFrom: `H${headingLevels[i - 1]}`,
        skippedTo: `H${headingLevels[i]}`,
      });
      break;
    }
  }

  // HTTP_STATUS
  if (page.statusCode >= 400) {
    deduct("HTTP_STATUS", -25, { statusCode: page.statusCode });
  }

  // NOINDEX_SET
  if (
    page.extracted.has_robots_meta &&
    page.extracted.robots_directives.includes("noindex")
  ) {
    deduct("NOINDEX_SET", -20);
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct("MISSING_CANONICAL", -8);
  }

  // MISSING_ALT_TEXT
  if (page.extracted.images_without_alt > 0) {
    const penalty = Math.min(page.extracted.images_without_alt * 3, 15);
    deduct("MISSING_ALT_TEXT", -penalty, {
      imagesWithoutAlt: page.extracted.images_without_alt,
    });
  }

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct("MISSING_OG_TAGS", -5);
  }

  // SLOW_RESPONSE
  if (
    page.siteContext?.responseTimeMs &&
    page.siteContext.responseTimeMs > 2000
  ) {
    deduct("SLOW_RESPONSE", -10, {
      responseTimeMs: page.siteContext.responseTimeMs,
    });
  }

  // MISSING_SITEMAP
  if (page.siteContext && !page.siteContext.hasSitemap) {
    deduct("MISSING_SITEMAP", -5);
  }

  return { score: Math.max(0, score), issues };
}
