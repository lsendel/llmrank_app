"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PipelineRecommendation } from "@/lib/api";

const PRIORITY_VARIANT: Record<
  PipelineRecommendation["priority"],
  "destructive" | "warning" | "info" | "secondary"
> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "secondary",
};

function actionHref(projectId: string, action?: string): string {
  switch (action) {
    case "get_action_items":
      return `/dashboard/projects/${projectId}?tab=issues`;
    case "discover_keywords_from_visibility":
      return `/dashboard/projects/${projectId}?tab=keywords`;
    case "run_full_analysis":
      return `/dashboard/projects/${projectId}?tab=strategy`;
    case "start_crawl":
    default:
      return `/dashboard/projects/${projectId}?tab=overview`;
  }
}

export function ProjectRecommendationsCard({
  projectId,
}: {
  projectId: string;
}) {
  const {
    data: recommendations,
    isLoading,
    error,
    mutate,
  } = useApiSWR(
    `project-recommendations-${projectId}`,
    useCallback(() => api.pipeline.recommendations(projectId), [projectId]),
  );

  if (isLoading) {
    return (
      <StateCard
        variant="loading"
        cardTitle="Recommended Next Actions"
        description="Loading recommended actions..."
      />
    );
  }

  if (error) {
    return (
      <StateCard
        variant="error"
        cardTitle="Recommended Next Actions"
        description="Could not load recommended actions right now."
        action={
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <StateCard
        variant="empty"
        cardTitle="Recommended Next Actions"
        icon={<CheckCircle2 className="h-5 w-5 text-success" />}
        description="No urgent gaps detected. Run a fresh crawl to re-check opportunities."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Recommended Next Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, index) => (
          <div
            key={`${rec.title}-${index}`}
            className="flex items-start justify-between gap-4 rounded-lg border p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={PRIORITY_VARIANT[rec.priority]}>
                  {rec.priority}
                </Badge>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {rec.category}
                </span>
              </div>
              <p className="text-sm font-medium">{rec.title}</p>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={actionHref(projectId, rec.action)}>
                Act
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
