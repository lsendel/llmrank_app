import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreMetaTags(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_TITLE (truly absent) vs TITLE_LENGTH (present but out of range)
  if (!page.title) {
    deduct(s, "MISSING_TITLE", { titleLength: 0 });
  } else if (
    page.title.length < THRESHOLDS.title.min ||
    page.title.length > THRESHOLDS.title.max
  ) {
    deduct(s, "TITLE_LENGTH", {
      titleLength: page.title.length,
      min: THRESHOLDS.title.min,
      max: THRESHOLDS.title.max,
    });
  }

  // MISSING_META_DESC (truly absent) vs META_DESC_LENGTH (out of range)
  if (!page.metaDescription) {
    deduct(s, "MISSING_META_DESC", { descLength: 0 });
  } else if (
    page.metaDescription.length < THRESHOLDS.metaDesc.min ||
    page.metaDescription.length > THRESHOLDS.metaDesc.max
  ) {
    deduct(s, "META_DESC_LENGTH", {
      descLength: page.metaDescription.length,
      min: THRESHOLDS.metaDesc.min,
      max: THRESHOLDS.metaDesc.max,
    });
  }

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct(s, "MISSING_OG_TAGS");
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct(s, "MISSING_CANONICAL");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
