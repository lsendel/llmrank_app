"use client";

import { useCallback, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ProjectProgress } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function narrativeSubtitle(progress: ProjectProgress): string {
  const delta = progress.scoreDelta;
  if (delta > 0) {
    return `Your score improved by ${delta.toFixed(1)} points — ${progress.issuesFixed} issue${progress.issuesFixed !== 1 ? "s" : ""} fixed`;
  }
  if (delta < 0) {
    return `Your score dropped by ${Math.abs(delta).toFixed(1)} points — ${progress.issuesNew} new issue${progress.issuesNew !== 1 ? "s" : ""} detected`;
  }
  return `Your score is stable — ${progress.issuesPersisting} issue${progress.issuesPersisting !== 1 ? "s" : ""} persist`;
}

function truncateUrl(url: string, max = 50): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return path.length > max ? path.slice(0, max - 1) + "…" : path;
  } catch {
    return url.length > max ? url.slice(0, max - 1) + "…" : url;
  }
}

export function ProjectProgressCard({ projectId }: { projectId: string }) {
  const { data: progress } = useApiSWR<ProjectProgress | null>(
    `progress-${projectId}`,
    useCallback(() => api.projects.progress(projectId), [projectId]),
  );
  const [moversOpen, setMoversOpen] = useState(false);

  if (!progress) return null;

  const deltaColor =
    progress.scoreDelta > 0
      ? "text-green-600"
      : progress.scoreDelta < 0
        ? "text-red-600"
        : "text-muted-foreground";

  const DeltaIcon =
    progress.scoreDelta > 0
      ? TrendingUp
      : progress.scoreDelta < 0
        ? TrendingDown
        : Minus;

  const hasMovers =
    progress.topImprovedPages.length > 0 ||
    progress.topRegressedPages.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DeltaIcon className={`h-5 w-5 ${deltaColor}`} />
          Progress Since Last Crawl
        </CardTitle>
        <CardDescription>{narrativeSubtitle(progress)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score delta hero */}
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${deltaColor}`}>
            {progress.scoreDelta > 0 ? "+" : ""}
            {progress.scoreDelta.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">
            points ({progress.previousScore.toFixed(0)} →{" "}
            {progress.currentScore.toFixed(0)})
          </span>
        </div>

        {/* Velocity indicator */}
        {progress.velocity !== 0 && (
          <div className="flex items-center gap-2 text-sm">
            {progress.velocity > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn(
                "font-medium",
                progress.velocity > 0 ? "text-green-600" : "text-red-600",
              )}
            >
              Improvement rate: {progress.velocity > 0 ? "+" : ""}
              {progress.velocity.toFixed(1)} pts/crawl
            </span>
          </div>
        )}

        {/* Category deltas */}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "technical", label: "Technical" },
              { key: "content", label: "Content" },
              { key: "aiReadiness", label: "AI Readiness" },
              { key: "performance", label: "Performance" },
            ] as const
          ).map(({ key, label }) => {
            const cat = progress.categoryDeltas[key];
            return (
              <div key={key} className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`text-sm font-semibold ${
                    cat.delta > 0
                      ? "text-green-600"
                      : cat.delta < 0
                        ? "text-red-600"
                        : ""
                  }`}
                >
                  {cat.delta > 0 ? "+" : ""}
                  {cat.delta.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Issues summary */}
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <ArrowDown className="h-3 w-3" />
            {progress.issuesFixed} fixed
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <ArrowUp className="h-3 w-3" />
            {progress.issuesNew} new
          </span>
          <span className="text-muted-foreground">
            {progress.issuesPersisting} persisting
          </span>
        </div>

        {/* Grade changes */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{progress.gradeChanges.improved} pages improved</span>
          <span>{progress.gradeChanges.regressed} regressed</span>
          <span>{progress.gradeChanges.unchanged} unchanged</span>
        </div>

        {/* Top movers (collapsible) */}
        {hasMovers && (
          <div>
            <button
              onClick={() => setMoversOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {moversOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Top movers
            </button>
            {moversOpen && (
              <div className="mt-2 space-y-3">
                {progress.topImprovedPages.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-green-600">
                      Improved
                    </p>
                    {progress.topImprovedPages.slice(0, 3).map((p) => (
                      <div
                        key={p.url}
                        className="flex items-center justify-between text-xs"
                      >
                        <span
                          className="truncate text-muted-foreground"
                          title={p.url}
                        >
                          {truncateUrl(p.url)}
                        </span>
                        <span className="ml-2 flex-shrink-0 font-medium text-green-600">
                          +{p.delta.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {progress.topRegressedPages.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-600">
                      Regressed
                    </p>
                    {progress.topRegressedPages.slice(0, 3).map((p) => (
                      <div
                        key={p.url}
                        className="flex items-center justify-between text-xs"
                      >
                        <span
                          className="truncate text-muted-foreground"
                          title={p.url}
                        >
                          {truncateUrl(p.url)}
                        </span>
                        <span className="ml-2 flex-shrink-0 font-medium text-red-600">
                          {p.delta.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
