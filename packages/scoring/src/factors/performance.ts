import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "./helpers";
import { THRESHOLDS } from "../thresholds";

export function scorePerformanceFactors(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };
  const hasLighthouse = !!page.lighthouse;
  const hasPageSize = !!page.siteContext?.pageSizeBytes;

  if (page.lighthouse) {
    // LH_PERF_LOW: -20 if <0.5, -10 if 0.5-0.79
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

  // Performance is only a real signal when something was actually measured —
  // Lighthouse, or at least a transferred page weight. Bulk crawls run with
  // Lighthouse gated off (`run_lighthouse: false`), so without this flag every
  // such page would contribute a fabricated 100 and inflate the overall and
  // per-platform scores. The engine drops performance's weight when unmeasured.
  const measured = hasLighthouse || hasPageSize;

  return { score: Math.max(0, s.score), issues: s.issues, measured };
}
