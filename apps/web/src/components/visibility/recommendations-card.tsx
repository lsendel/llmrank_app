"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type VisibilityRecommendation } from "@/lib/api";
import {
  Lightbulb,
  TrendingDown,
  Eye,
  AlertTriangle,
  Radio,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, typeof Lightbulb> = {
  gap: Eye,
  platform: AlertTriangle,
  issue: AlertTriangle,
  trend: TrendingDown,
  coverage: Radio,
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

export function RecommendationsCard({
  projectId,
  filters,
}: {
  projectId: string;
  filters?: { region?: string; language?: string };
}) {
  const { data, isLoading } = useApiSWR<VisibilityRecommendation[]>(
    `recommendations-${projectId}-${filters?.region ?? "all"}-${filters?.language ?? "all"}`,
    useCallback(
      () => api.visibility.getRecommendations(projectId, filters),
      [projectId, filters],
    ),
  );

  if (isLoading) {
    return (
      <StateCard
        variant="loading"
        description="Loading visibility recommendations..."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <StateCard
        variant="empty"
        cardTitle="Recommendations"
        icon={<Lightbulb className="h-5 w-5 text-muted-foreground" />}
        description="No actionable recommendations right now. Run more visibility checks to get insights."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Top Actions to Improve Visibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((rec, i) => {
          const Icon = TYPE_ICONS[rec.type] ?? Lightbulb;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-4"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{rec.title}</span>
                  <Badge
                    className={IMPACT_STYLES[rec.impact]}
                    variant="secondary"
                  >
                    {rec.impact}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {rec.description}
                </p>
              </div>
              {rec.fixUrl && (
                <Link href={rec.fixUrl}>
                  <Button size="sm" variant="outline">
                    Fix
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
