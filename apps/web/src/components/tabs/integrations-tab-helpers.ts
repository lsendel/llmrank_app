import type { CrawledPage } from "@/lib/api";
import {
  Activity,
  Gauge,
  MousePointerClick,
  Search,
  Share2,
  type LucideIcon,
} from "lucide-react";

export type SupportedProvider = "gsc" | "psi" | "ga4" | "clarity" | "meta";
type DeltaDirection = "positive" | "negative" | "neutral";

type IntegrationMeta = {
  provider: SupportedProvider;
  label: string;
  authType: "oauth2" | "api_key";
  description: string;
  minPlan: string;
  icon: LucideIcon;
  signupUrl?: string;
  signupHint?: string;
  docsUrl?: string;
  dataCollected: string[];
  reportEnhancements: string[];
};

export type IntegrationDeltaMetric = {
  id: string;
  label: string;
  currentValue: string;
  deltaValue: string;
  direction: DeltaDirection;
};

type FormattedDelta = Omit<IntegrationDeltaMetric, "id" | "label">;

export type SignalTaskDraft = {
  pageId?: string | null;
  issueCode: string;
  status: "pending";
  severity: "critical" | "warning" | "info";
  category: "technical" | "content" | "ai_readiness" | "performance";
  scoreImpact: number;
  title: string;
  description: string;
  assigneeId?: string | null;
  dueAt?: string | null;
};

type PageUrlLookup = {
  byFull: Map<string, string>;
  byPath: Map<string, string>;
};

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    provider: "gsc",
    label: "Google Search Console",
    authType: "oauth2",
    description: "Indexed pages, search queries, crawl stats",
    minPlan: "pro",
    icon: Search,
    signupUrl: "https://search.google.com/search-console",
    signupHint: "Go to Search Console and click Add property",
    dataCollected: [
      "Top search queries with impressions, clicks, and position",
      "Page-level index coverage status",
      "Crawl stats and errors from Google",
    ],
    reportEnhancements: [
      "Per-page Index Status badge in page scores",
      "Search query intent analysis in AI Readiness",
      "Click-through rate correlation with visibility",
    ],
  },
  {
    provider: "psi",
    label: "PageSpeed Insights",
    authType: "api_key",
    description: "Core Web Vitals and lab performance scores",
    minPlan: "pro",
    icon: Gauge,
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    dataCollected: [
      "Core Web Vitals (LCP, FID, CLS) per page",
      "Lab performance scores from Lighthouse",
      "Render-blocking resource detection",
    ],
    reportEnhancements: [
      "Real-world performance data in Performance scores",
      "CWV pass/fail badges on page detail views",
      "Performance trend tracking across crawls",
    ],
  },
  {
    provider: "ga4",
    label: "Google Analytics 4",
    authType: "oauth2",
    description: "Engagement metrics, bounce rate, sessions",
    minPlan: "agency",
    icon: Activity,
    signupUrl: "https://analytics.google.com",
    dataCollected: [
      "Average engagement time per page",
      "Bounce rate and session duration",
      "Top landing pages by traffic volume",
    ],
    reportEnhancements: [
      "Engagement-weighted scoring in Content pillar",
      "Traffic vs. AI-readiness correlation matrix",
      "ROI prioritization based on real traffic data",
    ],
  },
  {
    provider: "clarity",
    label: "Microsoft Clarity",
    authType: "api_key",
    description: "Heatmaps, dead clicks, rage clicks, scroll depth",
    minPlan: "agency",
    icon: MousePointerClick,
    dataCollected: [
      "UX quality score per page (0-100)",
      "Rage click and dead click detection",
      "Scroll depth and reading behavior",
    ],
    reportEnhancements: [
      "UX quality factor in AI Readiness scores",
      "Rage-click pages flagged as critical issues",
      "Content readability signals from scroll depth",
    ],
  },
  {
    provider: "meta",
    label: "Meta",
    authType: "oauth2",
    description: "Social engagement, shares, reactions, ad performance",
    minPlan: "free",
    icon: Share2,
    docsUrl: "https://developers.facebook.com/docs/graph-api/",
    dataCollected: [
      "Shares, reactions, and comments per page URL",
      "Open Graph tag validation (og:title, og:image)",
      "Ad performance by landing page (with Ad Account ID)",
    ],
    reportEnhancements: [
      "Social authority signal in Content scores",
      "Ad ROI by page for budget optimization",
      "OG tag validation for social sharing quality",
    ],
  },
];

const PLAN_ORDER = ["free", "starter", "pro", "agency"];
export const MAX_SIGNAL_TASKS = 30;

export function planAllows(userPlan: string, requiredPlan: string): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function dueAtDaysFromNow(days: number): string {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + days);
  due.setUTCHours(12, 0, 0, 0);
  return due.toISOString();
}

function normalizePath(path: string): string {
  if (!path) return "/";
  const trimmed =
    path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  return trimmed || "/";
}

function parseUrlKeys(raw: string): { full: string; path: string } | null {
  if (!raw || raw.trim().length === 0) return null;

  try {
    const parsed = new URL(raw);
    const path = normalizePath(parsed.pathname);
    const full = `${parsed.origin}${path}`.toLowerCase();
    return { full, path: path.toLowerCase() };
  } catch {
    return null;
  }
}

export function buildPageUrlLookup(pages: CrawledPage[]): PageUrlLookup {
  const byFull = new Map<string, string>();
  const byPath = new Map<string, string>();

  for (const page of pages) {
    const keys = parseUrlKeys(page.url);
    if (!keys) continue;

    if (!byFull.has(keys.full)) {
      byFull.set(keys.full, page.id);
    }

    if (!byPath.has(keys.path)) {
      byPath.set(keys.path, page.id);
    }
  }

  return { byFull, byPath };
}

export function resolvePageIdForSignalUrl(
  rawUrl: string,
  lookup: PageUrlLookup,
): string | null {
  const keys = parseUrlKeys(rawUrl);
  if (!keys) return null;
  return lookup.byFull.get(keys.full) ?? lookup.byPath.get(keys.path) ?? null;
}

export function truncateUrlPath(rawUrl: string): string {
  const keys = parseUrlKeys(rawUrl);
  if (!keys) return rawUrl;
  return keys.path.length > 42 ? `${keys.path.slice(0, 39)}...` : keys.path;
}

export function isNonIndexedStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("not") ||
    normalized.includes("error") ||
    normalized.includes("excluded") ||
    normalized.includes("blocked")
  );
}

export function formatDeltaNumber(
  current: number,
  previous: number,
  options?: {
    decimals?: number;
    suffix?: string;
    higherIsBetter?: boolean;
  },
): FormattedDelta {
  const decimals = options?.decimals ?? 0;
  const suffix = options?.suffix ?? "";
  const higherIsBetter = options?.higherIsBetter ?? true;
  const delta = current - previous;

  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const deltaAbs = Math.abs(delta);
  let direction: DeltaDirection = "neutral";
  if (deltaAbs > 0.0001) {
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    direction = improved ? "positive" : "negative";
  }

  return {
    currentValue: `${formatter.format(current)}${suffix}`,
    deltaValue: `${delta > 0 ? "+" : ""}${formatter.format(delta)}${suffix}`,
    direction,
  };
}
