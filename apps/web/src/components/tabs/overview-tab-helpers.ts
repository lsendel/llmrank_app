import {
  type CrawlJob,
  type PageIssue,
  type ProjectProgress,
  type SiteContext,
} from "@/lib/api";
import { confidenceFromPageSample } from "@/lib/insight-metadata";

export const OTHER_CATEGORY_DEFINITIONS = [
  { key: "technical", label: "Technical SEO (25%)" },
  { key: "content", label: "Content Quality (30%)" },
  { key: "performance", label: "Performance (15%)" },
] as const;

export type OverviewStatusState =
  | { kind: "loading"; crawlId: string }
  | { kind: "error"; errorMessage: string | null }
  | { kind: "empty" }
  | null;

export type OtherCategoryRow = {
  key: (typeof OTHER_CATEGORY_DEFINITIONS)[number]["key"];
  label: string;
  score: number | null | undefined;
  delta: number | undefined;
};

export type AiReadinessFactor = {
  code: string;
  label: string;
  pass: boolean;
  details?: string;
};

export function buildOverviewStatusState(
  latestCrawl: CrawlJob | null | undefined,
): OverviewStatusState {
  if (latestCrawl?.scores != null) return null;

  if (
    latestCrawl?.id &&
    (latestCrawl.status === "crawling" ||
      latestCrawl.status === "scoring" ||
      latestCrawl.status === "pending")
  ) {
    return { kind: "loading", crawlId: latestCrawl.id };
  }

  if (latestCrawl?.status === "failed") {
    return {
      kind: "error",
      errorMessage: latestCrawl.errorMessage ?? null,
    };
  }

  return { kind: "empty" };
}

export function buildOverviewMeta(latestCrawl: CrawlJob | null | undefined) {
  const hasScores = latestCrawl?.scores != null;
  const pagesSampled = Math.max(
    latestCrawl?.pagesScored ?? 0,
    latestCrawl?.pagesCrawled ?? 0,
    latestCrawl?.pagesFound ?? 0,
  );

  return {
    hasScores,
    pagesSampled,
    crawlTimestamp: latestCrawl?.completedAt ?? latestCrawl?.createdAt ?? null,
    dataConfidence: confidenceFromPageSample(pagesSampled),
    statusState: buildOverviewStatusState(latestCrawl),
  };
}

export function buildOtherCategoryRows(
  latestCrawl: CrawlJob,
  progress?: ProjectProgress | null,
) {
  return OTHER_CATEGORY_DEFINITIONS.map(({ key, label }) => ({
    key,
    label,
    score: latestCrawl.scores?.[key],
    delta: progress?.categoryDeltas[key]?.delta,
  })) satisfies OtherCategoryRow[];
}

/** Handle both camelCase and snake_case siteContext from DB JSONB. */
function normalizeSiteContext(
  raw: SiteContext | undefined,
): SiteContext | undefined {
  if (!raw) return raw;
  // Already camelCase
  if ("hasLlmsTxt" in raw) return raw;
  // snake_case from crawler — coerce
  const r = raw as unknown as Record<string, unknown>;
  return {
    hasLlmsTxt: (r.has_llms_txt as boolean) ?? false,
    hasSitemap: (r.has_sitemap as boolean) ?? false,
    aiCrawlersBlocked: (r.ai_crawlers_blocked as string[]) ?? [],
    contentHashes: (r.content_hashes as Record<string, string>) ?? {},
    sitemapAnalysis: r.sitemap_analysis
      ? {
          isValid: (r.sitemap_analysis as Record<string, unknown>)
            .is_valid as boolean,
          urlCount: (r.sitemap_analysis as Record<string, unknown>)
            .url_count as number,
          staleUrlCount: (r.sitemap_analysis as Record<string, unknown>)
            .stale_url_count as number,
          discoveredPageCount: (r.sitemap_analysis as Record<string, unknown>)
            .discovered_page_count as number,
        }
      : undefined,
  };
}

export function buildAiReadinessFactors(
  issues: PageIssue[],
  rawSiteContext?: SiteContext,
) {
  const issueCodes = new Set(issues.map((issue) => issue.code));
  const siteContext = normalizeSiteContext(rawSiteContext);

  const blocked = siteContext?.aiCrawlersBlocked ?? [];

  return [
    {
      code: "MISSING_LLMS_TXT",
      label: "llms.txt file",
      pass: siteContext
        ? siteContext.hasLlmsTxt
        : !issueCodes.has("MISSING_LLMS_TXT"),
    },
    {
      code: "AI_CRAWLER_BLOCKED",
      label: "AI crawlers allowed",
      pass: siteContext
        ? blocked.length === 0
        : !issueCodes.has("AI_CRAWLER_BLOCKED"),
      details:
        blocked.length > 0 ? `Blocked: ${blocked.join(", ")}` : undefined,
    },
    {
      code: "NO_SITEMAP",
      label: "Sitemap found",
      pass: siteContext
        ? siteContext.hasSitemap
        : !issueCodes.has("NO_SITEMAP"),
      details: siteContext?.sitemapAnalysis
        ? `${siteContext.sitemapAnalysis.urlCount} URLs`
        : undefined,
    },
    {
      code: "CITATION_WORTHINESS",
      label: "Citation-worthy content",
      pass: !issueCodes.has("CITATION_WORTHINESS"),
    },
  ] satisfies AiReadinessFactor[];
}
