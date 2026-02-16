"use client";

import { useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

interface TrendDataPoint {
  date: string;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  delta?: number;
}

interface ScoreTrendChartProps {
  projectId: string;
}

const LINE_COLORS = {
  overall: "hsl(var(--primary))",
  technical: "#3b82f6",
  content: "#22c55e",
  aiReadiness: "#a855f7",
  performance: "#f97316",
} as const;

const LINE_LABELS: Record<string, string> = {
  overall: "Overall",
  technical: "Technical",
  content: "Content",
  aiReadiness: "AI Readiness",
  performance: "Performance",
};

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ScoreTrendChart({ projectId }: ScoreTrendChartProps) {
  const { data: trendData, isLoading } = useApiSWR<TrendDataPoint[]>(
    `trends-${projectId}`,
    useCallback(() => api.trends.get(projectId), [projectId]),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" />
            Score Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading trends...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trendData || trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Score Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Run multiple crawls to see score trends over time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Identify regression points (delta < -5)
  const regressionPoints = trendData.filter(
    (point) => point.delta != null && point.delta < -5,
  );

  const lineKeys = [
    "overall",
    "technical",
    "content",
    "aiReadiness",
    "performance",
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Score Trends
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Last 90 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              labelFormatter={(value) => formatShortDate(String(value))}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                value,
                LINE_LABELS[name] ?? name,
              ]}
            />
            <Legend
              formatter={(value: string) => LINE_LABELS[value] ?? value}
            />
            {lineKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={LINE_COLORS[key]}
                strokeWidth={key === "overall" ? 2.5 : 1.5}
                dot={key === "overall"}
                activeDot={{ r: 4 }}
              />
            ))}
            {/* Regression markers as red dots on the overall line */}
            {regressionPoints.map((point) => (
              <ReferenceDot
                key={`regression-${point.date}`}
                x={point.date}
                y={point.overall}
                r={6}
                fill="hsl(0, 84%, 60%)"
                stroke="hsl(0, 84%, 40%)"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
