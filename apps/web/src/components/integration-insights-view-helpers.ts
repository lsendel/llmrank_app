import {
  Activity,
  Gauge,
  MousePointerClick,
  Search,
  Share2,
  type LucideIcon,
} from "lucide-react";
import type { IntegrationInsights } from "@/lib/api";

type Integrations = NonNullable<IntegrationInsights["integrations"]>;
type GscInsights = NonNullable<Integrations["gsc"]>;

export type SummaryItem = {
  icon: LucideIcon;
  label: string;
  value: string;
};

export const INSIGHT_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export function stripUrlOrigin(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

export function isIndexedStatus(status: string) {
  return status.toLowerCase().includes("indexed");
}

function getIndexedPageCount(gsc: GscInsights) {
  return gsc.indexedPages.filter(
    (page) =>
      page.status === "Submitted and indexed" ||
      page.status === "Indexed, not submitted in sitemap",
  ).length;
}

export function buildSummaryItems(integrations: Integrations): SummaryItem[] {
  const { gsc, ga4, clarity, meta, psi } = integrations;
  const items: SummaryItem[] = [];

  if (gsc) {
    const queryCount = gsc.topQueries?.length ?? 0;

    if (queryCount > 0) {
      const avgPos = (
        gsc.topQueries.reduce((sum, query) => sum + query.position, 0) /
        queryCount
      ).toFixed(1);
      items.push({
        icon: Search,
        label: "GSC",
        value: `${queryCount} queries tracked · avg position ${avgPos}`,
      });
    } else {
      const totalTracked = gsc.indexedPages.length;
      const nonIndexedCount = totalTracked - getIndexedPageCount(gsc);
      items.push({
        icon: Search,
        label: "GSC",
        value:
          totalTracked > 0
            ? `${totalTracked} pages tracked · ${nonIndexedCount} not indexed`
            : "No index data yet",
      });
    }
  }

  if (ga4) {
    const hasData =
      ga4.topPages.length > 0 || ga4.bounceRate > 0 || ga4.avgEngagement > 0;
    items.push({
      icon: Activity,
      label: "GA4",
      value: hasData
        ? `${ga4.avgEngagement.toFixed(0)}s avg engagement · ${ga4.bounceRate.toFixed(1)}% bounce rate`
        : "No sessions recorded yet",
    });
  }

  if (clarity) {
    const hasData = clarity.avgUxScore > 0 || clarity.rageClickPages.length > 0;
    items.push({
      icon: MousePointerClick,
      label: "Clarity",
      value: hasData
        ? `${clarity.avgUxScore.toFixed(0)}/100 UX score · ${clarity.rageClickPages.length} rage click pages`
        : "No sessions recorded yet",
    });
  }

  if (meta) {
    const totalEngagement =
      meta.totalShares + meta.totalReactions + meta.totalComments;
    items.push({
      icon: Share2,
      label: "Meta",
      value: `${totalEngagement.toLocaleString()} social engagements · ${meta.totalShares.toLocaleString()} shares`,
    });
  }

  if (psi) {
    const hasData = psi.avgPerformanceScore > 0;
    items.push({
      icon: Gauge,
      label: "PSI",
      value: hasData
        ? `${psi.avgPerformanceScore}/100 performance · ${psi.cwvPassRate}% CWV pass`
        : "No performance data yet",
    });
  }

  return items;
}
