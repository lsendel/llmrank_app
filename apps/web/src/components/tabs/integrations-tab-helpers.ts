import type { CrawledPage, IntegrationInsights } from "@/lib/api";
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

export type SignalTaskPlan = {
  reasons: string[];
  items: SignalTaskDraft[];
};

export type PageUrlLookup = {
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

export function buildIntegrationDeltaMetrics(
  integrationInsights: IntegrationInsights | undefined,
  previousInsights: IntegrationInsights | undefined,
): IntegrationDeltaMetric[] {
  if (!integrationInsights?.integrations || !previousInsights?.integrations) {
    return [];
  }

  const metrics: IntegrationDeltaMetric[] = [];
  const current = integrationInsights.integrations;
  const previous = previousInsights.integrations;

  if (current.gsc && previous.gsc) {
    const clicks = formatDeltaNumber(
      current.gsc.totalClicks ?? 0,
      previous.gsc.totalClicks ?? 0,
      { higherIsBetter: true },
    );
    metrics.push({
      id: "gsc-clicks",
      label: "GSC Clicks",
      currentValue: clicks.currentValue,
      deltaValue: clicks.deltaValue,
      direction: clicks.direction,
    });

    const nonIndexedCurrent = current.gsc.indexedPages.filter((page) =>
      isNonIndexedStatus(page.status),
    ).length;
    const nonIndexedPrevious = previous.gsc.indexedPages.filter((page) =>
      isNonIndexedStatus(page.status),
    ).length;
    const nonIndexed = formatDeltaNumber(
      nonIndexedCurrent,
      nonIndexedPrevious,
      {
        higherIsBetter: false,
      },
    );
    metrics.push({
      id: "gsc-non-indexed",
      label: "Non-indexed pages",
      currentValue: nonIndexed.currentValue,
      deltaValue: nonIndexed.deltaValue,
      direction: nonIndexed.direction,
    });
  }

  if (current.ga4 && previous.ga4) {
    const bounce = formatDeltaNumber(
      current.ga4.bounceRate ?? 0,
      previous.ga4.bounceRate ?? 0,
      { decimals: 1, suffix: "%", higherIsBetter: false },
    );
    metrics.push({
      id: "ga4-bounce",
      label: "GA4 bounce rate",
      currentValue: bounce.currentValue,
      deltaValue: bounce.deltaValue,
      direction: bounce.direction,
    });
  }

  if (current.clarity && previous.clarity) {
    const uxScore = formatDeltaNumber(
      current.clarity.avgUxScore ?? 0,
      previous.clarity.avgUxScore ?? 0,
      { decimals: 1, higherIsBetter: true },
    );
    metrics.push({
      id: "clarity-ux",
      label: "Clarity UX score",
      currentValue: uxScore.currentValue,
      deltaValue: uxScore.deltaValue,
      direction: uxScore.direction,
    });
  }

  if (current.meta && previous.meta) {
    const currentEngagement =
      current.meta.totalShares +
      current.meta.totalReactions +
      current.meta.totalComments;
    const previousEngagement =
      previous.meta.totalShares +
      previous.meta.totalReactions +
      previous.meta.totalComments;
    const engagement = formatDeltaNumber(
      currentEngagement,
      previousEngagement,
      {
        higherIsBetter: true,
      },
    );
    metrics.push({
      id: "meta-engagement",
      label: "Meta engagement",
      currentValue: engagement.currentValue,
      deltaValue: engagement.deltaValue,
      direction: engagement.direction,
    });
  }

  // Filter out metrics where both current and previous are zero (no meaningful data)
  return metrics.filter((m) => {
    const current = parseFloat(m.currentValue.replace(/[^0-9.-]/g, ""));
    const delta = parseFloat(m.deltaValue.replace(/[^0-9.-]/g, ""));
    return current !== 0 || delta !== 0;
  });
}

export function buildSignalTaskPlan({
  integrationInsights,
  pageUrlLookup,
  currentUserId,
}: {
  integrationInsights: IntegrationInsights | undefined;
  pageUrlLookup: PageUrlLookup;
  currentUserId: string | null;
}): SignalTaskPlan {
  const reasons: string[] = [];
  const items: SignalTaskDraft[] = [];
  const integrationsData = integrationInsights?.integrations;
  if (!integrationsData) {
    return { reasons, items };
  }

  const gsc = integrationsData.gsc;
  if (gsc) {
    const nonIndexedPages = gsc.indexedPages.filter((page) =>
      isNonIndexedStatus(page.status),
    );
    if (nonIndexedPages.length > 0) {
      reasons.push(
        `${nonIndexedPages.length} page${nonIndexedPages.length === 1 ? "" : "s"} are not indexed in Google.`,
      );
      const severity: "critical" | "warning" =
        nonIndexedPages.length >= 10 ? "critical" : "warning";
      const dueAt =
        severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7);
      let unmappedCount = 0;

      for (const page of nonIndexedPages.slice(0, 15)) {
        const pageId = resolvePageIdForSignalUrl(page.url, pageUrlLookup);
        if (!pageId) {
          unmappedCount += 1;
          continue;
        }
        items.push({
          pageId,
          issueCode: "INTEGRATION_GSC_NOT_INDEXED",
          status: "pending",
          severity,
          category: "technical",
          scoreImpact: severity === "critical" ? 10 : 8,
          title: `Fix Google indexing issue: ${truncateUrlPath(page.url)}`,
          description: `Google Search Console reported "${page.status}" for this page.`,
          assigneeId: currentUserId,
          dueAt,
        });
      }

      if (unmappedCount > 0) {
        items.push({
          issueCode: "INTEGRATION_GSC_NOT_INDEXED_UNMAPPED",
          status: "pending",
          severity,
          category: "technical",
          scoreImpact: 7,
          title: "Review non-indexed pages from Google Search Console",
          description: `${unmappedCount} non-indexed page URL${unmappedCount === 1 ? "" : "s"} could not be mapped to crawl pages.`,
          assigneeId: currentUserId,
          dueAt,
        });
      }
    }
  }

  const clarity = integrationsData.clarity;
  if (clarity && clarity.rageClickPages.length > 0) {
    reasons.push(
      `${clarity.rageClickPages.length} page${clarity.rageClickPages.length === 1 ? "" : "s"} have rage-click events in Clarity.`,
    );
    const severity: "critical" | "warning" =
      clarity.rageClickPages.length >= 6 ? "critical" : "warning";
    const dueAt =
      severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7);

    for (const url of clarity.rageClickPages.slice(0, 10)) {
      items.push({
        pageId: resolvePageIdForSignalUrl(url, pageUrlLookup),
        issueCode: "INTEGRATION_CLARITY_RAGE_CLICKS",
        status: "pending",
        severity,
        category: "performance",
        scoreImpact: severity === "critical" ? 8 : 6,
        title: `Investigate rage clicks: ${truncateUrlPath(url)}`,
        description:
          "Microsoft Clarity detected repeated rage clicks that indicate UX friction.",
        assigneeId: currentUserId,
        dueAt,
      });
    }
  }

  const ga4 = integrationsData.ga4;
  if (ga4 && ga4.bounceRate >= 65) {
    reasons.push(
      `GA4 bounce rate is ${ga4.bounceRate.toFixed(1)}%, above the 65% review threshold.`,
    );
    const severity: "critical" | "warning" =
      ga4.bounceRate >= 75 ? "critical" : "warning";
    items.push({
      issueCode: "INTEGRATION_GA4_HIGH_BOUNCE",
      status: "pending",
      severity,
      category: "content",
      scoreImpact: severity === "critical" ? 8 : 6,
      title: "Reduce bounce rate on top landing pages",
      description: `Current bounce rate is ${ga4.bounceRate.toFixed(1)}% with average engagement ${ga4.avgEngagement.toFixed(0)} seconds.`,
      assigneeId: currentUserId,
      dueAt:
        severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7),
    });
  }

  return { reasons, items };
}
