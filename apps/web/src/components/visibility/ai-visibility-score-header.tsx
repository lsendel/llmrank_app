"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type AIScoreTrend } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, Loader2, Users } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-600",
  B: "text-blue-600",
  C: "text-amber-600",
  D: "text-orange-600",
  F: "text-red-600",
};

const SCORE_BG: Record<string, string> = {
  A: "bg-green-50 border-green-200",
  B: "bg-blue-50 border-blue-200",
  C: "bg-amber-50 border-amber-200",
  D: "bg-orange-50 border-orange-200",
  F: "bg-red-50 border-red-200",
};

const SIGNAL_LABELS = [
  { key: "llmMentions", label: "LLM Mentions", max: 40 },
  { key: "aiSearch", label: "AI Search Presence", max: 30 },
  { key: "shareOfVoice", label: "Share of Voice", max: 20 },
  { key: "backlinkAuthority", label: "Backlink Authority", max: 10 },
] as const;

export function AIVisibilityScoreHeader({ projectId }: { projectId: string }) {
  const { data, isLoading } = useApiSWR<AIScoreTrend>(
    `ai-score-trend-${projectId}`,
    useCallback(() => api.visibility.getScoreTrend(projectId), [projectId]),
  );

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { current, delta, direction } = data;
  const TrendIcon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    direction === "up"
      ? "text-green-600"
      : direction === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  const audienceGrowthColor =
    data.meta.audienceGrowth > 0
      ? "text-green-600"
      : data.meta.audienceGrowth < 0
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Card 1: Overall Score */}
      <Card className={`border ${SCORE_BG[current.grade]}`}>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              AI Visibility Score
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold">{current.overall}</span>
              <span
                className={`text-2xl font-bold ${GRADE_COLORS[current.grade]}`}
              >
                {current.grade}
              </span>
            </div>
            {delta !== 0 && (
              <div
                className={`mt-2 flex items-center gap-1 text-sm ${trendColor}`}
              >
                <TrendIcon className="h-4 w-4" />
                <span>
                  {delta > 0 ? "+" : ""}
                  {delta} vs last week
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Signal Breakdown */}
      <Card>
        <CardContent className="p-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Score Breakdown
          </p>
          <div className="space-y-2.5">
            {SIGNAL_LABELS.map(({ key, label, max }) => {
              const value =
                current.breakdown[key as keyof typeof current.breakdown];
              const pct = Math.round((value / max) * 100);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-medium">
                      {value}/{max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Est. Monthly Reach */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              Est. Monthly Reach
            </p>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {data.meta.estimatedMonthlyAudience.toLocaleString()}
            </span>
          </div>
          {data.meta.audienceGrowth !== 0 && (
            <div
              className={`mt-2 flex items-center gap-1 text-sm ${audienceGrowthColor}`}
            >
              {data.meta.audienceGrowth > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {data.meta.audienceGrowth > 0 ? "+" : ""}
                {data.meta.audienceGrowth}% vs last week
              </span>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            People seeing AI responses about your brand
          </p>
        </CardContent>
      </Card>

      {/* Card 4: Check Stats */}
      <Card>
        <CardContent className="p-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Tracking Summary
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Checks this week</span>
              <span className="font-medium">{data.meta.currentChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Previous week</span>
              <span className="font-medium">{data.meta.previousChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Referring domains</span>
              <span className="font-medium">{data.meta.referringDomains}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Period</span>
              <span className="font-medium capitalize">{data.period}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
