"use client";

import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats, DashboardActivity } from "@/lib/api";

interface NextStep {
  label: string;
  href: string;
}

function deriveSteps(
  stats: DashboardStats,
  activity: DashboardActivity[],
): NextStep[] {
  const steps: NextStep[] = [];

  if (stats.totalProjects === 0) {
    steps.push({
      label: "Create your first project",
      href: "/dashboard/projects/new",
    });
  }

  if (stats.totalCrawls === 0) {
    steps.push({
      label: "Run your first crawl",
      href: "/dashboard/projects",
    });
  }

  const failedCrawl = activity.find((a) => a.status === "failed");
  if (failedCrawl) {
    steps.push({
      label: "Review failed crawl",
      href: `/dashboard/crawl/${failedCrawl.id}`,
    });
  }

  if (stats.avgScore > 0 && stats.avgScore < 70) {
    // Link to worst-scoring project's crawl if available
    const worstCrawl = [...activity]
      .filter((a) => a.status === "complete" && a.overallScore !== null)
      .sort((a, b) => (a.overallScore ?? 100) - (b.overallScore ?? 100))[0];
    steps.push({
      label: "Fix critical issues to improve your score",
      href: worstCrawl
        ? `/dashboard/projects/${worstCrawl.projectId}`
        : "/dashboard/projects",
    });
  }

  if (activity.length > 0) {
    const latest = activity[0];
    if (latest.completedAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(latest.completedAt).getTime()) / 86_400_000,
      );
      if (daysSince > 7) {
        steps.push({
          label: "Run a new crawl to track progress",
          href: "/dashboard/projects",
        });
      }
    }
  }

  if (stats.totalProjects > 0 && stats.totalProjects < 3) {
    steps.push({
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

  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          What to Do Next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span>{step.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
