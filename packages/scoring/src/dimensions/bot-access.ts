import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreBotAccess(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // HTTP_STATUS (server/client error) vs HTTP_GONE (410, intentional removal)
  if (page.statusCode === 410) {
    deduct(s, "HTTP_GONE", { statusCode: 410 });
  } else if (page.statusCode >= THRESHOLDS.httpErrorStatus) {
    deduct(s, "HTTP_STATUS", { statusCode: page.statusCode });
  }

  // SLOW_RESPONSE
  if (
    page.siteContext?.responseTimeMs &&
    page.siteContext.responseTimeMs > THRESHOLDS.slowResponseMs
  ) {
    deduct(s, "SLOW_RESPONSE", {
      responseTimeMs: page.siteContext.responseTimeMs,
    });
  }

  // REDIRECT_CHAIN
  if (
    page.redirectChain &&
    page.redirectChain.length >= THRESHOLDS.redirectChainMaxHops
  ) {
    deduct(s, "REDIRECT_CHAIN", {
      hops: page.redirectChain.length,
      chain: page.redirectChain.map((h) => `${h.status_code} ${h.url}`),
    });
  }

  // CORS_MIXED_CONTENT
  if (
    page.extracted.cors_mixed_content &&
    page.extracted.cors_mixed_content > 0
  ) {
    deduct(s, "CORS_MIXED_CONTENT", {
      mixedContentCount: page.extracted.cors_mixed_content,
    });
  }

  // CORS_UNSAFE_LINKS
  if (
    page.extracted.cors_unsafe_blank_links &&
    page.extracted.cors_unsafe_blank_links > 0
  ) {
    deduct(s, "CORS_UNSAFE_LINKS", {
      unsafeBlankLinks: page.extracted.cors_unsafe_blank_links,
    });
  }

  // LH_PERF_LOW: -20 if <0.5, -10 if 0.5-0.79
  if (page.lighthouse) {
    if (page.lighthouse.performance < THRESHOLDS.lighthouse.perfLow) {
      deduct(s, "LH_PERF_LOW", {
        performance: page.lighthouse.performance,
      });
    } else if (
      page.lighthouse.performance < THRESHOLDS.lighthouse.perfModerate
    ) {
      deduct(s, "LH_PERF_LOW", -10, {
        performance: page.lighthouse.performance,
      });
    }

    // LH_SEO_LOW: -15 if <0.8
    if (page.lighthouse.seo < THRESHOLDS.lighthouse.seoLow) {
      deduct(s, "LH_SEO_LOW", { seo: page.lighthouse.seo });
    }

    // LH_A11Y_LOW: -5 if <0.7
    if (page.lighthouse.accessibility < THRESHOLDS.lighthouse.a11yLow) {
      deduct(s, "LH_A11Y_LOW", {
        accessibility: page.lighthouse.accessibility,
      });
    }

    // LH_BP_LOW: -5 if <0.8
    if (
      page.lighthouse.best_practices < THRESHOLDS.lighthouse.bestPracticesLow
    ) {
      deduct(s, "LH_BP_LOW", {
        bestPractices: page.lighthouse.best_practices,
      });
    }
  }

  // LARGE_PAGE_SIZE: -10 if pageSizeBytes > 3MB
  if (
    page.siteContext?.pageSizeBytes &&
    page.siteContext.pageSizeBytes > THRESHOLDS.largePageSizeBytes
  ) {
    deduct(s, "LARGE_PAGE_SIZE", {
      pageSizeBytes: page.siteContext.pageSizeBytes,
      pageSizeMB:
        Math.round((page.siteContext.pageSizeBytes / (1024 * 1024)) * 100) /
        100,
    });
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
