"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { CrawlJob } from "@/lib/api";

export function ScoreTrendChart({
  crawlHistory,
}: {
  crawlHistory: CrawlJob[];
}) {
  const completedCrawls = crawlHistory
    .filter((c) => c.status === "complete" && c.overallScore != null)
    .reverse(); // oldest first for the chart

  if (completedCrawls.length < 2) return null;

  const data = completedCrawls.map((c) => ({
    date: new Date(c.startedAt || c.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    overall: c.overallScore,
    technical: c.scores?.technical,
    content: c.scores?.content,
    aiReadiness: c.scores?.aiReadiness,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Score Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="overall"
              name="Overall"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="technical"
              name="Technical"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="content"
              name="Content"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="aiReadiness"
              name="AI Readiness"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
