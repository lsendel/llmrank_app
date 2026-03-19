import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Clock,
  Eye,
  FileText,
  FolderKanban,
  History,
  Play,
  Plus,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import { cn, gradeColor } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { getStatusBadgeVariant } from "@/lib/status";
import type { DashboardWidgetId } from "@llm-boost/shared";
import type {
  DashboardActivity,
  DashboardStats,
} from "@/lib/api/types/dashboard";
import type { LastProjectContext } from "@/lib/workflow-memory";
import type { DashboardQuickToolId } from "@/lib/personalization-layout";
import {
  formatDashboardDelta,
  PILLAR_LABELS,
  QUICK_TOOL_META,
  type SinceLastVisitSummary,
} from "../dashboard-page-helpers";
import { lastProjectContextHref, projectTabLabel } from "@/lib/workflow-memory";

const AI_FEATURES = [
  {
    title: "AI Content Scoring",
    description: "37 factors scored by Claude to measure AI-readiness",
    icon: Brain,
  },
  {
    title: "LLM Visibility Tracking",
    description: "See if ChatGPT, Claude, Perplexity mention your brand",
    icon: Eye,
  },
  {
    title: "AI Fix Generator",
    description: "One-click AI-generated fixes for SEO issues",
    icon: Sparkles,
  },
] as const;

export function DashboardHeader({ firstName }: { firstName: string }) {
  return (
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
  );
}

export function DashboardWorkflowCard() {
  return (
    <WorkflowGuidance
      title="Daily operating flow"
      description="Follow a consistent loop so score movement, fixes, and crawl freshness stay in sync."
      actions={[
        {
          label: "Open Portfolio",
          href: "/dashboard/projects",
          variant: "outline",
        },
        {
          label: "View Crawl History",
          href: "/dashboard/history",
          variant: "ghost",
        },
      ]}
      steps={[
        {
          title: "Review changes since last visit",
          description:
            "Validate completed, failed, and in-progress crawls before making decisions.",
          icon: Clock,
          href: "/dashboard/history",
        },
        {
          title: "Execute the highest-impact next step",
          description:
            "Use guided recommendations and quick wins to prioritize the next action.",
          icon: Sparkles,
          href: "/dashboard/priority-feed",
        },
        {
          title: "Refresh data on key projects",
          description:
            "Start or schedule crawls so recommendations stay aligned with current site state.",
          icon: Play,
          href: "/dashboard/projects",
        },
      ]}
    />
  );
}

export function DashboardLastProjectCard({
  lastProjectContext,
}: {
  lastProjectContext: LastProjectContext | null;
}) {
  if (!lastProjectContext) return null;

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Continue where you left off</CardTitle>
        <CardDescription>
          Last active {formatRelativeTime(lastProjectContext.visitedAt)} in{" "}
          {lastProjectContext.projectName ||
            lastProjectContext.domain ||
            "your project"}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Resume in{" "}
          <span className="font-medium text-foreground">
            {projectTabLabel(lastProjectContext.tab)}
          </span>
        </div>
        <Button asChild size="sm">
          <Link href={lastProjectContextHref(lastProjectContext)}>
            Resume project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardSinceLastVisitCard({
  sinceLastVisit,
  effectiveLastVisitAt,
}: {
  sinceLastVisit: SinceLastVisitSummary;
  effectiveLastVisitAt: string | null;
}) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Since your last visit</CardTitle>
        <CardDescription>
          {sinceLastVisit.hasBaseline && effectiveLastVisitAt
            ? `Last seen ${formatRelativeTime(effectiveLastVisitAt)}`
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
          <Badge variant="success">Completed: {sinceLastVisit.completed}</Badge>
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
  );
}

export function DashboardQuickTools({
  stats,
  activity,
  quickToolOrder,
}: {
  stats: DashboardStats;
  activity: DashboardActivity[];
  quickToolOrder: DashboardQuickToolId[];
}) {
  if (stats.totalProjects <= 0 || activity.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {quickToolOrder.map((toolId) => {
        const meta = QUICK_TOOL_META[toolId];
        const Icon = meta.icon;
        return (
          <Card key={toolId} className="hover:bg-accent/5 transition-colors">
            <Link
              href={`/dashboard/projects/${activity[0].projectId}?tab=${meta.tab}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {meta.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {meta.description}
                </p>
              </CardContent>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

export function DashboardAiFeaturesBanner({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss: () => void;
}) {
  if (!show) return null;

  return (
    <Card className="relative border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <button
        onClick={onDismiss}
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
          {AI_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex gap-3 rounded-lg border bg-background p-3"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardWidgets({
  widgetOrder,
  stats,
  activity,
  onWidgetClick,
}: {
  widgetOrder: DashboardWidgetId[];
  stats: DashboardStats;
  activity: DashboardActivity[];
  onWidgetClick: (widgetId: DashboardWidgetId) => void;
}) {
  const insights = stats.latestInsights;

  return widgetOrder.map((widgetId) => {
    switch (widgetId) {
      case "stats":
        return (
          <div
            key="stats"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onClick={() => onWidgetClick("stats")}
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
          <Card
            key="score_momentum"
            onClick={() => onWidgetClick("score_momentum")}
          >
            <CardHeader>
              <CardTitle>Score Momentum</CardTitle>
              <CardDescription>
                Delta against your previous completed crawl
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Overall", value: insights.scoreDeltas.overall },
                { label: "Technical", value: insights.scoreDeltas.technical },
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
                    <p className={cn("text-lg font-semibold", meta.className)}>
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
          <Card key="quick_wins" onClick={() => onWidgetClick("quick_wins")}>
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
                    <span>{PILLAR_LABELS[win.pillar] ?? win.pillar}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case "readiness":
        if (!insights) return null;
        return (
          <Card key="readiness" onClick={() => onWidgetClick("readiness")}>
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
                  <Progress value={metric.coveragePercent} className="h-2" />
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
          <Card key="activity" onClick={() => onWidgetClick("activity")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
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
              {activity.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recent activity. Start a crawl to see results here.
                </p>
              ) : (
                <div className="space-y-0">
                  {activity.map((item, index) => (
                    <div key={item.id}>
                      {index > 0 && <div className="border-t border-border" />}
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
                                {item.pagesCrawled ?? item.pagesScored} pages
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
  });
}

export function DashboardMobileQuickActions() {
  return (
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
  );
}
