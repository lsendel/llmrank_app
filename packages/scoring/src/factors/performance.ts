import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";
import type { PageData, FactorResult } from "../types";

export function scorePerformanceFactors(page: PageData): FactorResult {
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

  if (page.lighthouse) {
    // LH_PERF_LOW: -20 if <0.5, -10 if 0.5-0.79
    if (page.lighthouse.performance < 0.5) {
      deduct("LH_PERF_LOW", -20, { performance: page.lighthouse.performance });
    } else if (page.lighthouse.performance < 0.8) {
      deduct("LH_PERF_LOW", -10, { performance: page.lighthouse.performance });
    }

    // LH_SEO_LOW: -15 if <0.8
    if (page.lighthouse.seo < 0.8) {
      deduct("LH_SEO_LOW", -15, { seo: page.lighthouse.seo });
    }

    // LH_A11Y_LOW: -5 if <0.7
    if (page.lighthouse.accessibility < 0.7) {
      deduct("LH_A11Y_LOW", -5, {
        accessibility: page.lighthouse.accessibility,
      });
    }

    // LH_BP_LOW: -5 if <0.8
    if (page.lighthouse.best_practices < 0.8) {
      deduct("LH_BP_LOW", -5, {
        bestPractices: page.lighthouse.best_practices,
      });
    }
  }

  // LARGE_PAGE_SIZE: -10 if pageSizeBytes > 3MB
  if (
    page.siteContext?.pageSizeBytes &&
    page.siteContext.pageSizeBytes > 3 * 1024 * 1024
  ) {
    deduct("LARGE_PAGE_SIZE", -10, {
      pageSizeBytes: page.siteContext.pageSizeBytes,
      pageSizeMB:
        Math.round((page.siteContext.pageSizeBytes / (1024 * 1024)) * 100) /
        100,
    });
  }

  return { score: Math.max(0, score), issues };
}
