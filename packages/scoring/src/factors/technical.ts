import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreTechnicalFactors(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_TITLE
  if (
    !page.title ||
    page.title.length < THRESHOLDS.title.min ||
    page.title.length > THRESHOLDS.title.max
  ) {
    deduct(s, "MISSING_TITLE", -15, { titleLength: page.title?.length ?? 0 });
  }

  // MISSING_META_DESC
  if (
    !page.metaDescription ||
    page.metaDescription.length < THRESHOLDS.metaDesc.min ||
    page.metaDescription.length > THRESHOLDS.metaDesc.max
  ) {
    deduct(s, "MISSING_META_DESC", -10, {
      descLength: page.metaDescription?.length ?? 0,
    });
  }

  // MISSING_H1
  if (page.extracted.h1.length === 0) {
    deduct(s, "MISSING_H1", -8);
  }

  // MULTIPLE_H1
  if (page.extracted.h1.length > 1) {
    deduct(s, "MULTIPLE_H1", -5, { h1Count: page.extracted.h1.length });
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
      deduct(s, "HEADING_HIERARCHY", -3, {
        skippedFrom: `H${headingLevels[i - 1]}`,
        skippedTo: `H${headingLevels[i]}`,
      });
      break;
    }
  }

  // HTTP_STATUS
  if (page.statusCode >= THRESHOLDS.httpErrorStatus) {
    deduct(s, "HTTP_STATUS", -25, { statusCode: page.statusCode });
  }

  // NOINDEX_SET
  if (
    page.extracted.has_robots_meta &&
    page.extracted.robots_directives.includes("noindex")
  ) {
    deduct(s, "NOINDEX_SET", -20);
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct(s, "MISSING_CANONICAL", -8);
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

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct(s, "MISSING_OG_TAGS", -5);
  }

  // SLOW_RESPONSE
  if (
    page.siteContext?.responseTimeMs &&
    page.siteContext.responseTimeMs > THRESHOLDS.slowResponseMs
  ) {
    deduct(s, "SLOW_RESPONSE", -10, {
      responseTimeMs: page.siteContext.responseTimeMs,
    });
  }

  // MISSING_SITEMAP
  if (page.siteContext && !page.siteContext.hasSitemap) {
    deduct(s, "MISSING_SITEMAP", -5);
  }

  // SITEMAP_INVALID_FORMAT
  if (
    page.siteContext?.hasSitemap &&
    page.siteContext.sitemapAnalysis &&
    !page.siteContext.sitemapAnalysis.isValid
  ) {
    deduct(s, "SITEMAP_INVALID_FORMAT", -8);
  }

  // SITEMAP_STALE_URLS
  if (
    page.siteContext?.sitemapAnalysis &&
    page.siteContext.sitemapAnalysis.staleUrlCount > 0
  ) {
    deduct(s, "SITEMAP_STALE_URLS", -3, {
      staleUrlCount: page.siteContext.sitemapAnalysis.staleUrlCount,
      totalUrls: page.siteContext.sitemapAnalysis.urlCount,
    });
  }

  // SITEMAP_LOW_COVERAGE
  if (
    page.siteContext?.sitemapAnalysis &&
    page.siteContext.sitemapAnalysis.discoveredPageCount > 0
  ) {
    const coverage =
      page.siteContext.sitemapAnalysis.urlCount /
      page.siteContext.sitemapAnalysis.discoveredPageCount;
    if (coverage < THRESHOLDS.sitemapCoverageMin) {
      deduct(s, "SITEMAP_LOW_COVERAGE", -5, {
        sitemapUrls: page.siteContext.sitemapAnalysis.urlCount,
        discoveredPages: page.siteContext.sitemapAnalysis.discoveredPageCount,
        coverage: Math.round(coverage * 100),
      });
    }
  }

  // REDIRECT_CHAIN
  if (
    page.redirectChain &&
    page.redirectChain.length >= THRESHOLDS.redirectChainMaxHops
  ) {
    deduct(s, "REDIRECT_CHAIN", -8, {
      hops: page.redirectChain.length,
      chain: page.redirectChain.map((h) => `${h.status_code} ${h.url}`),
    });
  }

  // CORS_MIXED_CONTENT
  if (
    page.extracted.cors_mixed_content &&
    page.extracted.cors_mixed_content > 0
  ) {
    deduct(s, "CORS_MIXED_CONTENT", -5, {
      mixedContentCount: page.extracted.cors_mixed_content,
    });
  }

  // CORS_UNSAFE_LINKS
  if (
    page.extracted.cors_unsafe_blank_links &&
    page.extracted.cors_unsafe_blank_links > 0
  ) {
    deduct(s, "CORS_UNSAFE_LINKS", -3, {
      unsafeBlankLinks: page.extracted.cors_unsafe_blank_links,
    });
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
