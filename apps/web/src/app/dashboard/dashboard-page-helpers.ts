import { Compass, Eye, Trophy, type LucideIcon } from "lucide-react";
import type { DashboardActivity } from "@/lib/api/types/dashboard";
import type { DashboardQuickToolId } from "@/lib/personalization-layout";

export const DASHBOARD_LAST_VISIT_KEY = "dashboard.last_visit_at";

export const PILLAR_LABELS: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
};

export const QUICK_TOOL_META: Record<
  DashboardQuickToolId,
  {
    title: string;
    description: string;
    tab: "strategy" | "competitors" | "visibility";
    icon: LucideIcon;
  }
> = {
  strategy_personas: {
    title: "Strategy & Personas",
    description: "Define your target audience and generate content briefs.",
    tab: "strategy",
    icon: Compass,
  },
  competitor_tracking: {
    title: "Competitor Tracking",
    description: "Monitor how you stack up against your top 5 competitors.",
    tab: "competitors",
    icon: Trophy,
  },
  ai_visibility: {
    title: "AI Visibility",
    description: "Check if your brand is mentioned by major AI models.",
    tab: "visibility",
    icon: Eye,
  },
};

export interface SinceLastVisitSummary {
  hasBaseline: boolean;
  completed: number;
  failed: number;
  inProgress: number;
  projectsTouched: number;
  feedEvents: number;
  narrative: string;
}

export function formatDashboardDelta(delta: number) {
  if (delta > 0) {
    return { label: `+${delta} vs last crawl`, className: "text-emerald-600" };
  }
  if (delta < 0) {
    return { label: `${delta} vs last crawl`, className: "text-red-600" };
  }
  return { label: "No change", className: "text-muted-foreground" };
}

function activityTimestamp(item: {
  completedAt: string | null;
  createdAt: string;
}) {
  const candidate = item.completedAt ?? item.createdAt;
  const ts = new Date(candidate).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function sinceVisitNarrative(input: {
  hasBaseline: boolean;
  completed: number;
  failed: number;
  inProgress: number;
}): string {
  if (!input.hasBaseline) {
    return "This is your first dashboard visit from this browser. We will summarize crawl outcomes and anomalies after your next visit.";
  }

  if (input.completed === 0 && input.failed === 0 && input.inProgress === 0) {
    return "No new crawl activity since your last visit. Run a crawl to refresh insights.";
  }

  const parts: string[] = [];
  if (input.completed > 0) {
    parts.push(
      `${input.completed} crawl${input.completed === 1 ? "" : "s"} completed`,
    );
  }
  if (input.failed > 0) {
    parts.push(`${input.failed} failed`);
  }
  if (input.inProgress > 0) {
    parts.push(`${input.inProgress} in progress`);
  }
  return `Since your last visit: ${parts.join(", ")}.`;
}

export function buildSinceLastVisitSummary(
  activity: DashboardActivity[] | null | undefined,
  effectiveLastVisitAt: string | null,
): SinceLastVisitSummary {
  const baseline = effectiveLastVisitAt
    ? new Date(effectiveLastVisitAt).getTime()
    : null;
  const hasBaseline = baseline != null && Number.isFinite(baseline);
  const source = activity ?? [];

  const feedSinceVisit = hasBaseline
    ? source.filter((item) => {
        const ts = activityTimestamp(item);
        return ts != null && ts > baseline;
      })
    : source;

  const completed = feedSinceVisit.filter(
    (item) => item.status === "complete",
  ).length;
  const failed = feedSinceVisit.filter(
    (item) => item.status === "failed",
  ).length;
  const inProgress = feedSinceVisit.filter(
    (item) =>
      item.status === "pending" ||
      item.status === "crawling" ||
      item.status === "scoring",
  ).length;

  return {
    hasBaseline,
    completed,
    failed,
    inProgress,
    projectsTouched: new Set(feedSinceVisit.map((item) => item.projectId)).size,
    feedEvents: feedSinceVisit.length,
    narrative: sinceVisitNarrative({
      hasBaseline,
      completed,
      failed,
      inProgress,
    }),
  };
}
