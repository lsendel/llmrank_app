"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type IntegrationInsights } from "@/lib/api";
import { Search, Users, Zap } from "lucide-react";

export function IntegrationInsightsCards({ projectId }: { projectId: string }) {
  const { data: insights } = useApiSWR<IntegrationInsights>(
    `integrations-insights-${projectId}`,
    useCallback(() => api.integrations.insights(projectId), [projectId]),
  );

  if (!insights?.integrations) return null;

  const { gsc, ga4, clarity } = insights.integrations;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {gsc && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Search Visibility
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gsc.topQueries[0]?.impressions.toLocaleString() ?? "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Impressions for &ldquo;{gsc.topQueries[0]?.query ?? "top query"}
              &rdquo;
            </p>
          </CardContent>
        </Card>
      )}

      {ga4 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              User Engagement
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ga4.avgEngagement.toFixed(0)}s
            </div>
            <p className="text-xs text-muted-foreground">
              Average session duration
            </p>
          </CardContent>
        </Card>
      )}

      {clarity && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">UX Quality</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clarity.avgUxScore.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Microsoft Clarity UX Score
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
