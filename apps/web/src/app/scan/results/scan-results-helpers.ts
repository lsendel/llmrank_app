import type { PublicScanResult, QuickWin } from "@/lib/api";

export const EFFORT_LABELS = {
  low: { label: "Quick Fix", color: "bg-success/10 text-success" },
  medium: { label: "Moderate", color: "bg-warning/10 text-warning" },
  high: { label: "Significant", color: "bg-destructive/10 text-destructive" },
} as const;

export const VISIBILITY_PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  gemini_ai_mode: "Gemini AI Mode",
  grok: "Grok",
};

export const SCORE_CATEGORIES = [
  { label: "Technical SEO", key: "technical" },
  { label: "Content Quality", key: "content" },
  { label: "AI Readiness", key: "aiReadiness" },
  { label: "Performance", key: "performance" },
] as const;

export type ScanResultCta =
  | "create_project"
  | "connect_integration"
  | "schedule_recurring_scan";

export type ScanResultCtaPlacement = "unlock_banner" | "results_next_actions";

export interface ScanVisibilityCheck {
  provider: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition?: number | null;
  competitorMentions?:
    | { domain: string; mentioned: boolean; position: number | null }[]
    | null;
}

export interface ScanFindingItem {
  pass: boolean;
  label: string;
  details?: string;
}

export function getVisibilityProviderLabel(provider: string): string {
  return VISIBILITY_PROVIDER_LABELS[provider] ?? provider;
}

export function getQuickWinEffort(
  effortLevel: QuickWin["effortLevel"] | string,
) {
  return (
    EFFORT_LABELS[effortLevel as keyof typeof EFFORT_LABELS] ??
    EFFORT_LABELS.medium
  );
}

export function getScoreCategories(scores: PublicScanResult["scores"]) {
  return SCORE_CATEGORIES.map((category) => ({
    label: category.label,
    score: scores[category.key],
  }));
}

export function getVisibilityChecks(
  visibility: PublicScanResult["visibility"],
): ScanVisibilityCheck[] {
  if (Array.isArray(visibility)) {
    return visibility;
  }

  return visibility ? [visibility] : [];
}

export function getPagesSampled(
  result: Pick<PublicScanResult, "issues" | "siteContext" | "meta">,
): number {
  return Math.max(
    result.meta?.siteContext?.sitemapAnalysis?.discoveredPageCount ??
      result.siteContext?.sitemapAnalysis?.discoveredPageCount ??
      0,
    result.issues.length,
    1,
  );
}

export function getFindingItems(
  meta: NonNullable<PublicScanResult["meta"]>,
): ScanFindingItem[] {
  return [
    { pass: meta.hasLlmsTxt, label: "llms.txt file" },
    {
      pass: meta.aiCrawlersBlocked.length === 0,
      label: "AI crawlers allowed",
      details:
        meta.aiCrawlersBlocked.length > 0
          ? `Blocked: ${meta.aiCrawlersBlocked.join(", ")}`
          : undefined,
    },
    {
      pass: meta.hasSitemap,
      label: "Sitemap found",
      details:
        meta.sitemapUrls > 0 ? `${meta.sitemapUrls} URLs found` : undefined,
    },
    { pass: meta.schemaTypes.length > 0, label: "Structured data" },
    {
      pass: !!meta.title && meta.title.length >= 30 && meta.title.length <= 60,
      label: "Title tag (30-60 chars)",
    },
    {
      pass: Object.keys(meta.ogTags).length > 0,
      label: "Open Graph tags",
    },
  ];
}

export function getRecurringScanDestination(isSignedIn: boolean): string {
  return isSignedIn ? "/dashboard/projects" : "/pricing";
}
