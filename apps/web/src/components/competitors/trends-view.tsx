"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { Loader2, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CATEGORIES = [
  { key: "overall", label: "Overall" },
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "aiReadiness", label: "AI Readiness" },
  { key: "performance", label: "Performance" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

const PERIODS = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 180, label: "180d" },
] as const;

const LINE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

interface TrendDataPoint {
  date: string;
  [domain: string]: string | number;
}

interface CompetitorInfo {
  domain: string;
  id?: string;
}

interface TrendsViewProps {
  projectId: string;
  competitors: CompetitorInfo[];
  competitorTrendDays: number;
}

export function TrendsView({
  projectId,
  competitors,
  competitorTrendDays,
}: TrendsViewProps) {
  const { withAuth } = useApi();
  const [category, setCategory] = useState<Category>("overall");
  const [period, setPeriod] = useState(90);
  const [chartData, setChartData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clamp period to allowed days (safe even when competitorTrendDays is 0)
  const effectivePeriod = Math.min(period, Math.max(competitorTrendDays, 1));

  const fetchTrends = useCallback(async () => {
    if (competitors.length === 0 || competitorTrendDays === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch trend data for each competitor in parallel
      const results = await withAuth(() =>
        Promise.all(
          competitors.map((c) =>
            api.competitorMonitoring
              .getTrends(projectId, c.domain, effectivePeriod)
              .then((res) => ({
                domain: c.domain,
                points: (res?.points ?? res?.data ?? []) as Array<
                  Record<string, unknown>
                >,
              })),
          ),
        ),
      );

      // Merge all competitor data points into a single timeline
      const dateMap = new Map<string, TrendDataPoint>();

      for (const { domain, points } of results ?? []) {
        for (const point of points) {
          const dateKey = (point.date ?? point.createdAt ?? "") as string;
          const shortDate =
            typeof dateKey === "string"
              ? dateKey.slice(0, 10)
              : String(dateKey);
          if (!dateMap.has(shortDate)) {
            dateMap.set(shortDate, { date: shortDate });
          }
          const row = dateMap.get(shortDate)!;
          row[domain] = (point[category] ?? point.overall ?? 0) as number;
        }
      }

      // Sort by date
      const sorted = Array.from(dateMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      setChartData(sorted);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load trend data",
      );
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    competitors,
    effectivePeriod,
    category,
    competitorTrendDays,
    withAuth,
  ]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Gate: if trendDays is 0, show upgrade CTA
  if (competitorTrendDays === 0) {
    return (
      <UpgradePrompt
        feature="Competitor Score Trends"
        description="Track how competitor AI-readiness scores change over time. See trends across all scoring categories."
        nextTier="Starter ($79/mo)"
        nextTierUnlocks="30-day trend charts, activity feed, watchlist queries"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Category selector */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            variant={category === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat.key)}
          >
            {cat.label}
          </Button>
        ))}

        <div className="ml-auto flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.value)}
              disabled={p.value > competitorTrendDays}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading trends...
        </div>
      )}

      {/* Empty state */}
      {!loading && competitors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">
              No competitors benchmarked yet. Add competitors in the Benchmark
              tab to see trend data.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {CATEGORIES.find((c) => c.key === category)?.label ?? "Overall"}{" "}
              Score Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {competitors.map((c, i) => (
                  <Line
                    key={c.domain}
                    type="monotone"
                    dataKey={c.domain}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* No data after loading */}
      {!loading &&
        competitors.length > 0 &&
        chartData.length === 0 &&
        !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">
                No trend data available yet. Scores will appear after your
                competitors have been monitored over time.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
