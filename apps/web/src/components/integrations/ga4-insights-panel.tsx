"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Ga4Data {
  bounceRate: number;
  avgEngagement: number;
  topPages: { url: string; sessions: number }[];
}

export function Ga4InsightsPanel({ data }: { data: Ga4Data }) {
  const chartData = data.topPages.slice(0, 10).map((p) => {
    try {
      return {
        name:
          new URL(p.url, "https://example.com").pathname.slice(0, 30) || "/",
        sessions: p.sessions,
      };
    } catch {
      return { name: p.url.slice(0, 30), sessions: p.sessions };
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Analytics 4</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Headline metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Bounce Rate</p>
            <p className="text-2xl font-bold">{data.bounceRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              Avg Engagement Time
            </p>
            <p className="text-2xl font-bold">
              {data.avgEngagement.toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={140}
                />
                <Tooltip />
                <Bar
                  dataKey="sessions"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Pages Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Page</th>
                <th className="pb-2 text-right">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((page) => (
                <tr key={page.url} className="border-b border-border/50">
                  <td className="py-2 pr-4 truncate max-w-xs" title={page.url}>
                    {page.url}
                  </td>
                  <td className="py-2 text-right">
                    {page.sessions.toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.topPages.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="py-4 text-center text-muted-foreground"
                  >
                    No engagement data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
