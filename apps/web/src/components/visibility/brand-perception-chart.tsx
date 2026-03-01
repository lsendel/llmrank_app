"use client";

import { useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BrandPerceptionProvider,
  type BrandSentimentSnapshot,
} from "@/lib/api";
import { Activity } from "lucide-react";

interface ChartPoint {
  period: string;
  sentimentScore: number;
  sampleSize: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  gemini_ai_mode: "AI Search",
  grok: "Grok",
};

export function BrandPerceptionChart({
  projectId,
  filters,
}: {
  projectId: string;
  filters?: { region?: string; language?: string };
}) {
  const { data: snapshots, isLoading } = useApiSWR<BrandSentimentSnapshot[]>(
    `brand-sentiment-history-${projectId}`,
    useCallback(() => api.brand.getSentimentHistory(projectId), [projectId]),
  );
  const { data: perception } = useApiSWR<BrandPerceptionProvider[]>(
    `brand-perception-providers-${projectId}-${filters?.region ?? "all"}-${filters?.language ?? "all"}`,
    useCallback(
      () => api.brand.getPerception(projectId, filters),
      [projectId, filters],
    ),
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!snapshots || snapshots.length === 0) return [];

    return [...snapshots]
      .sort((a, b) => {
        const aTs = new Date(a.createdAt).getTime();
        const bTs = new Date(b.createdAt).getTime();
        return aTs - bTs;
      })
      .filter((snapshot) => snapshot.sentimentScore != null)
      .map((snapshot) => ({
        period: formatPeriodLabel(snapshot.period),
        sentimentScore: Number(snapshot.sentimentScore),
        sampleSize: snapshot.sampleSize,
      }));
  }, [snapshots]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Brand Perception Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Loading sentiment trend...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Brand Perception Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Build weekly sentiment history to see how brand perception changes
            over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = chartData[chartData.length - 1];
  const previous =
    chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const delta = previous
    ? Math.round((latest.sentimentScore - previous.sentimentScore) * 100) / 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Brand Perception Trend
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Latest: {latest.sentimentScore > 0 ? "+" : ""}
              {latest.sentimentScore.toFixed(2)}
            </Badge>
            {previous && (
              <Badge variant={delta >= 0 ? "success" : "destructive"}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(2)} WoW
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[-1, 1]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => value.toFixed(1)}
              className="fill-muted-foreground"
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border))"
              strokeDasharray="4 4"
            />
            <Tooltip
              formatter={(value: number) => [
                `${value > 0 ? "+" : ""}${value.toFixed(2)}`,
                "Sentiment",
              ]}
              labelFormatter={(label) => `Period: ${label}`}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="sentimentScore"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground">
          Scale is -1.0 (negative perception) to +1.0 (positive perception).
        </p>
        {perception && perception.length > 0 && (
          <div className="space-y-2 border-t border-border/70 pt-3">
            <p className="text-sm font-medium">
              How each platform describes you
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {perception.map((row) => (
                <div
                  key={row.provider}
                  className="rounded-md border border-border/70 bg-muted/20 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {PROVIDER_LABELS[row.provider] ?? row.provider}
                    </p>
                    <Badge
                      variant={
                        row.overallSentiment === "positive"
                          ? "success"
                          : row.overallSentiment === "negative"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.sentimentScore > 0 ? "+" : ""}
                      {row.sentimentScore.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Samples: {row.sampleSize} • P/N/N:{" "}
                    {row.distribution.positive}/{row.distribution.neutral}/
                    {row.distribution.negative}
                  </p>
                  {row.descriptions[0] && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      &ldquo;{row.descriptions[0]}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatPeriodLabel(period: string): string {
  // ISO week format expected (e.g., 2026-W08). Keep fallback safe.
  const match = /^(\d{4})-W(\d{2})$/.exec(period);
  if (!match) return period;
  const [, year, week] = match;
  return `${year} W${week}`;
}
