"use client";

import { useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type CrawlerTimelinePoint } from "@/lib/api";

const BOT_COLORS: Record<string, string> = {
  gptbot: "#10a37f",
  claudebot: "#d97706",
  perplexitybot: "#6366f1",
  googlebot: "#3b82f6",
  bingbot: "#ef4444",
  other: "#6b7280",
};

const BOT_LABELS: Record<string, string> = {
  gptbot: "GPTBot",
  claudebot: "ClaudeBot",
  perplexitybot: "PerplexityBot",
  googlebot: "Googlebot",
  bingbot: "Bingbot",
  other: "Other",
};

export function CrawlerTimelineChart({ projectId }: { projectId: string }) {
  const { data: timeline, isLoading } = useApiSWR<CrawlerTimelinePoint[]>(
    `crawler-timeline-${projectId}`,
    useCallback(
      (token: string) => api.logs.getCrawlerTimeline(token, projectId),
      [projectId],
    ),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Crawler Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Crawler Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upload server logs to see which AI crawlers visit your site.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bots = [
    "gptbot",
    "claudebot",
    "perplexitybot",
    "googlebot",
    "bingbot",
    "other",
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          AI Crawler Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend formatter={(value: string) => BOT_LABELS[value] ?? value} />
            {bots.map((bot) => (
              <Area
                key={bot}
                type="monotone"
                dataKey={bot}
                stackId="1"
                stroke={BOT_COLORS[bot]}
                fill={BOT_COLORS[bot]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
