"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/auth-hooks";
import {
  PersonaDiscoveryModal,
  shouldShowPersonaModal,
} from "@/components/persona-discovery-modal";
import {
  FolderKanban,
  BarChart3,
  Clock,
  Plus,
  Play,
  ArrowRight,
  FileText,
  AlertTriangle,
  Zap,
  Brain,
  Eye,
  Sparkles,
  X,
  Compass,
  Trophy,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, gradeColor } from "@/lib/utils";
import { api } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { NextStepsCard } from "@/components/cards/next-steps-card";
import { PercentileBadge } from "@/components/percentile-badge";
import { usePersonaLayout } from "@/hooks/use-persona-layout";
import { useDashboardStats, useRecentActivity } from "@/hooks/use-dashboard";
import { track } from "@/lib/telemetry";
import { formatRelativeTime } from "@/lib/format";
import { getStatusBadgeVariant } from "@/lib/status";
import { StateMessage } from "@/components/ui/state";
import type { DashboardWidgetId } from "@llm-boost/shared";

function formatDashboardDelta(delta: number) {
  if (delta > 0)
    return { label: `+${delta} vs last crawl`, className: "text-emerald-600" };
  if (delta < 0)
    return { label: `${delta} vs last crawl`, className: "text-red-600" };
  return { label: "No change", className: "text-muted-foreground" };
}

const pillarLabels: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
};
const DASHBOARD_LAST_VISIT_KEY = "dashboard.last_visit_at";

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

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ai-features-banner-dismissed") === "1";
  });
  const [lastVisitAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    const previous = window.localStorage.getItem(DASHBOARD_LAST_VISIT_KEY);
    window.localStorage.setItem(
      DASHBOARD_LAST_VISIT_KEY,
      new Date().toISOString(),
    );
    return previous;
  });

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();

  // Persona discovery modal for existing users without a persona
  const [personaDismissed, setPersonaDismissed] = useState(false);
  const [accountData, setAccountData] = useState<{
    persona: string | null;
  } | null>(null);

  useEffect(() => {
    api.account
      .getMe()
      .then(setAccountData)
      .catch(() => {});
  }, []);

  const personaModalOpen =
    !personaDismissed &&
    !!accountData &&
    !accountData.persona &&
    !!stats &&
    stats.totalProjects > 0 &&
    shouldShowPersonaModal();

  // Persona-based widget ordering
  const { widgetOrder, isPersonalized } = usePersonaLayout(
    accountData?.persona,
  );

  // Track dashboard load with persona context
  useEffect(() => {
    if (!stats || !accountData) return;
    track("dashboard_loaded", {
      persona: accountData.persona,
      isPersonalized,
      widgetOrder: widgetOrder.join(","),
    });
  }, [stats, accountData, isPersonalized, widgetOrder]);

  const loading = statsLoading || activityLoading;
  const sinceLastVisit = useMemo(() => {
    const baseline = lastVisitAt ? new Date(lastVisitAt).getTime() : null;
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
      projectsTouched: new Set(feedSinceVisit.map((item) => item.projectId))
        .size,
      feedEvents: feedSinceVisit.length,
      narrative: sinceVisitNarrative({
        hasBaseline,
        completed,
        failed,
        inProgress,
      }),
    };
  }, [activity, lastVisitAt]);

  if (loading) {
    return (
      <StateMessage
        variant="loading"
        title="Loading dashboard"
        description="Fetching portfolio stats and recent crawl activity."
        className="py-16"
      />
    );
  }

  if (!stats) {
    return (
      <StateMessage
        variant="empty"
        title="No project data yet"
        description="Create your first project to start crawl-based insights and automation."
        className="py-16"
        action={
          <Button asChild>
            <Link href="/dashboard/projects/new">Create Project</Link>
          </Button>
        }
      />
    );
  }

  const insights = stats.latestInsights;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here is an overview of your AI-readiness scores and recent activity.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button asChild variant="outline">
            <Link href="/dashboard/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/projects">
              <Play className="h-4 w-4" />
              Start Crawl
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Since your last visit</CardTitle>
          <CardDescription>
            {sinceLastVisit.hasBaseline && lastVisitAt
              ? `Last seen ${formatRelativeTime(lastVisitAt)}`
              : "First visit from this browser"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Feed events: {sinceLastVisit.feedEvents}
            </Badge>
            <Badge variant="secondary">
              Projects touched: {sinceLastVisit.projectsTouched}
            </Badge>
            <Badge variant="success">
              Completed: {sinceLastVisit.completed}
            </Badge>
            <Badge
              variant={sinceLastVisit.failed > 0 ? "destructive" : "secondary"}
            >
              Failed: {sinceLastVisit.failed}
            </Badge>
            <Badge
              variant={sinceLastVisit.inProgress > 0 ? "warning" : "secondary"}
            >
              In progress: {sinceLastVisit.inProgress}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {sinceLastVisit.narrative}
          </p>
          <p className="text-xs text-muted-foreground">
            Based on your latest dashboard activity feed.
          </p>
        </CardContent>
      </Card>

      {/* What to Do Next */}
      <NextStepsCard stats={stats} activity={activity ?? []} />

      {/* Percentile Badge */}
      {stats.avgScore > 0 && <PercentileBadge avgScore={stats.avgScore} />}

      {/* Quick Tools */}
      {stats.totalProjects > 0 && activity && activity.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:bg-accent/5 transition-colors">
            <Link
              href={`/dashboard/projects/${activity[0].projectId}?tab=strategy`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  Strategy & Personas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Define your target audience and generate content briefs.
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:bg-accent/5 transition-colors">
            <Link
              href={`/dashboard/projects/${activity[0].projectId}?tab=competitors`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Competitor Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor how you stack up against your top 5 competitors.
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:bg-accent/5 transition-colors">
            <Link
              href={`/dashboard/projects/${activity[0].projectId}?tab=visibility`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  AI Visibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Check if your brand is mentioned by major AI models.
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>
      )}

      {/* AI Features onboarding banner — shown for new users with 0 crawls */}
      {stats.totalCrawls === 0 && !bannerDismissed && (
        <Card className="relative border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <button
            onClick={() => {
              setBannerDismissed(true);
              localStorage.setItem("ai-features-banner-dismissed", "1");
            }}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              What makes LLM Rank different
            </CardTitle>
            <CardDescription>
              Go beyond traditional SEO — optimize for AI search engines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex gap-3 rounded-lg border bg-background p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">AI Content Scoring</p>
                  <p className="text-xs text-muted-foreground">
                    37 factors scored by Claude to measure AI-readiness
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border bg-background p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">LLM Visibility Tracking</p>
                  <p className="text-xs text-muted-foreground">
                    See if ChatGPT, Claude, Perplexity mention your brand
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border bg-background p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">AI Fix Generator</p>
                  <p className="text-xs text-muted-foreground">
                    One-click AI-generated fixes for SEO issues
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Persona-ordered widgets */}
      {widgetOrder.map((widgetId) => {
        const trackClick = () =>
          track("dashboard_widget_clicked", {
            widgetId,
            persona: accountData?.persona,
            isPersonalized,
          });

        switch (widgetId as DashboardWidgetId) {
          case "stats":
            return (
              <div
                key="stats"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                onClick={trackClick}
              >
                <Card className="hover:bg-accent/5 transition-colors cursor-pointer">
                  <Link href="/dashboard/projects">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FolderKanban className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Projects
                          </p>
                          <p className="text-2xl font-semibold">
                            {stats.totalProjects}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
                <Card className="hover:bg-accent/5 transition-colors cursor-pointer">
                  <Link href="/dashboard/history">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <History className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Crawls
                          </p>
                          <p className="text-2xl font-semibold">
                            {stats.totalCrawls}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Average Score
                        </p>
                        <p
                          className={cn(
                            "text-2xl font-semibold",
                            gradeColor(stats.avgScore),
                          )}
                        >
                          {stats.avgScore}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Credits Remaining
                        </p>
                        <p className="text-2xl font-semibold">
                          {stats.creditsRemaining}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{stats.creditsTotal}
                          </span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );

          case "score_momentum":
            if (!insights) return null;
            return (
              <Card key="score_momentum" onClick={trackClick}>
                <CardHeader>
                  <CardTitle>Score Momentum</CardTitle>
                  <CardDescription>
                    Delta against your previous completed crawl
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Overall", value: insights.scoreDeltas.overall },
                    {
                      label: "Technical",
                      value: insights.scoreDeltas.technical,
                    },
                    { label: "Content", value: insights.scoreDeltas.content },
                    {
                      label: "AI Readiness",
                      value: insights.scoreDeltas.aiReadiness,
                    },
                    {
                      label: "Performance",
                      value: insights.scoreDeltas.performance,
                    },
                  ].map((row) => {
                    const meta = formatDashboardDelta(row.value);
                    return (
                      <div
                        key={row.label}
                        className="flex items-center justify-between border-b border-border/50 pb-2 last:border-none"
                      >
                        <div>
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className={cn("text-xs", meta.className)}>
                            {meta.label}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "text-lg font-semibold",
                            meta.className,
                          )}
                        >
                          {row.value > 0 ? `+${row.value}` : row.value}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );

          case "quick_wins":
            if (!insights) return null;
            return (
              <Card key="quick_wins" onClick={trackClick}>
                <CardHeader>
                  <CardTitle>Top Quick Wins</CardTitle>
                  <CardDescription>
                    High-impact fixes pulled from your latest crawl
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.quickWins.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No outstanding issues detected. Great job!
                    </p>
                  )}
                  {insights.quickWins.map((win) => (
                    <div
                      key={win.code}
                      className="rounded-md border border-border/60 p-3"
                    >
                      <p className="text-sm font-medium">{win.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {win.recommendation}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Owner: {win.owner}</span>
                        <span>Effort: {win.effort}</span>
                        <span>+{win.scoreImpact} pts</span>
                        <span>{win.affectedPages} pages</span>
                        <span>{pillarLabels[win.pillar] ?? win.pillar}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );

          case "readiness":
            if (!insights) return null;
            return (
              <Card key="readiness" onClick={trackClick}>
                <CardHeader>
                  <CardTitle>Readiness Coverage</CardTitle>
                  <CardDescription>
                    Share of pages meeting critical technical controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.coverage.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Coverage metrics will appear after your next crawl.
                    </p>
                  )}
                  {insights.coverage.map((metric) => (
                    <div key={metric.code} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{metric.label}</span>
                        <span>{metric.coveragePercent}%</span>
                      </div>
                      <Progress
                        value={metric.coveragePercent}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        {metric.totalPages - metric.affectedPages}/
                        {metric.totalPages} pages compliant
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );

          case "activity":
            return (
              <Card key="activity" onClick={trackClick}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Recent Activity
                      </CardTitle>
                      <CardDescription>
                        Last 5 crawl jobs across all projects.
                      </CardDescription>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/projects">
                        View all
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(activity ?? []).length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No recent activity. Start a crawl to see results here.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {(activity ?? []).map((item, index) => (
                        <div key={item.id}>
                          {index > 0 && (
                            <div className="border-t border-border" />
                          )}
                          <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full",
                                  item.status === "complete"
                                    ? "bg-success/10"
                                    : item.status === "failed"
                                      ? "bg-destructive/10"
                                      : "bg-warning/10",
                                )}
                              >
                                {item.status === "complete" ? (
                                  <BarChart3 className="h-4 w-4 text-success" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/dashboard/projects/${item.projectId}`}
                                    className="text-sm font-medium hover:text-primary"
                                  >
                                    {item.projectName}
                                  </Link>
                                  <Badge
                                    variant={getStatusBadgeVariant(item.status)}
                                  >
                                    {item.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {item.pagesCrawled ?? item.pagesScored}{" "}
                                    pages
                                  </span>
                                  {item.completedAt && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatRelativeTime(item.completedAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              {item.overallScore !== null ? (
                                <span
                                  className={cn(
                                    "text-lg font-bold",
                                    gradeColor(item.overallScore),
                                  )}
                                >
                                  {item.overallScore}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  --
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );

          default:
            return null;
        }
      })}

      {/* Quick actions (mobile) */}
      <div className="flex gap-2 sm:hidden">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/dashboard/projects">
            <Play className="h-4 w-4" />
            Start Crawl
          </Link>
        </Button>
      </div>

      {/* Persona discovery modal for existing users */}
      <PersonaDiscoveryModal
        open={personaModalOpen}
        onClose={() => setPersonaDismissed(true)}
        defaultDomain={undefined}
      />
    </div>
  );
}
