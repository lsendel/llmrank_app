"use client";

import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state";
import type { DashboardStats, DashboardActivity } from "@/lib/api";

interface NextStep {
  id: string;
  label: string;
  href: string;
  hint?: string;
  ctaLabel?: string;
  variant?: "default" | "warning";
}

function pushStep(steps: NextStep[], candidate: NextStep) {
  const alreadyIncluded = steps.some(
    (step) => step.label === candidate.label && step.href === candidate.href,
  );
  if (!alreadyIncluded) {
    steps.push(candidate);
  }
}

function deriveSteps(
  stats: DashboardStats,
  activity: DashboardActivity[],
): NextStep[] {
  const steps: NextStep[] = [];
  const workflowProjectId =
    activity.find((item) => item.status === "complete")?.projectId ??
    activity[0]?.projectId;

  const topQuickWin = [...(stats.latestInsights?.quickWins ?? [])].sort(
    (a, b) => b.scoreImpact - a.scoreImpact,
  )[0];
  if (topQuickWin && workflowProjectId) {
    pushStep(steps, {
      id: "top-quick-win",
      label: topQuickWin.message,
      hint: `+${Math.abs(topQuickWin.scoreImpact)} pts • ${topQuickWin.affectedPages} pages`,
      href: `/dashboard/projects/${workflowProjectId}?tab=issues`,
      ctaLabel: "Open fix workflow",
      variant: "warning",
    });
  }

  if (stats.totalProjects === 0) {
    pushStep(steps, {
      id: "create-project",
      label: "Create your first project",
      href: "/dashboard/projects/new",
    });
  }

  if (stats.totalCrawls === 0) {
    pushStep(steps, {
      id: "first-crawl",
      label: "Run your first crawl",
      href: "/dashboard/projects",
    });
  }

  const failedCrawl = activity.find((a) => a.status === "failed");
  if (failedCrawl) {
    pushStep(steps, {
      id: "failed-crawl",
      label: "Review failed crawl",
      href: `/dashboard/crawl/${failedCrawl.id}`,
      ctaLabel: "Inspect failure",
    });
  }

  if (stats.avgScore > 0 && stats.avgScore < 70) {
    // Link to worst-scoring project's crawl if available
    const worstCrawl = [...activity]
      .filter((a) => a.status === "complete" && a.overallScore !== null)
      .sort((a, b) => (a.overallScore ?? 100) - (b.overallScore ?? 100))[0];
    pushStep(steps, {
      id: "critical-issues",
      label: "Fix critical issues to improve your score",
      href: worstCrawl
        ? `/dashboard/projects/${worstCrawl.projectId}?tab=issues`
        : "/dashboard/projects",
      ctaLabel: "Open issue workflow",
    });
  }

  if (activity.length > 0) {
    const latest = activity[0];
    if (latest.completedAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(latest.completedAt).getTime()) / 86_400_000,
      );
      if (daysSince > 7) {
        pushStep(steps, {
          id: "stale-crawl",
          label: "Run a new crawl to track progress",
          href: "/dashboard/projects",
        });
      }
    }
  }

  if (stats.totalProjects > 0 && stats.totalProjects < 3) {
    pushStep(steps, {
      id: "add-project",
      label: "Add another site to monitor",
      href: "/dashboard/projects/new",
    });
  }

  return steps.slice(0, 3);
}

export function NextStepsCard({
  stats,
  activity,
}: {
  stats: DashboardStats;
  activity: DashboardActivity[];
}) {
  const steps = deriveSteps(stats, activity);

  if (steps.length === 0) {
    return (
      <StateCard
        variant="empty"
        cardTitle="What to Do Next"
        title="No priorities right now"
        description="Run a crawl or add another project to generate prioritized actions."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/projects">Open projects</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          What to Do Next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{step.label}</p>
              {step.hint ? (
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {step.variant === "warning" ? (
                <Badge variant="warning">Anomaly</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {step.ctaLabel ?? "Open"}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
