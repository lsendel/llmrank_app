"use client";

import { useCallback } from "react";
import { TrendingUp } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type VisibilityTrend } from "@/lib/api";

const PROVIDER_COLORS: Record<string, string> = {
  chatgpt: "#10a37f",
  claude: "#d97706",
  perplexity: "#6366f1",
  gemini: "#3b82f6",
  copilot: "#8b5cf6",
};

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
};

interface ChartDataPoint {
  week: string;
  [provider: string]: number | string;
}

export function ShareOfVoiceChart({ projectId }: { projectId: string }) {
  const { data: trends, isLoading: loading } = useApiSWR<VisibilityTrend[]>(
    `sov-trends-${projectId}`,
    useCallback(
      (token: string) => api.visibility.getTrends(token, projectId),
      [projectId],
    ),
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Share of Voice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading trends...</p>
        </CardContent>
      </Card>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Share of Voice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run visibility checks over multiple weeks to see trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Pivot data: group by week, one key per provider
  const weekMap = new Map<string, ChartDataPoint>();
  const providers = new Set<string>();

  for (const t of trends) {
    providers.add(t.provider);
    const existing = weekMap.get(t.weekStart) ?? {
      week: formatWeek(t.weekStart),
    };
    existing[t.provider] = Math.round(t.mentionRate * 100);
    weekMap.set(t.weekStart, existing);
  }

  const chartData = Array.from(weekMap.values());
  const providerList = Array.from(providers);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Share of Voice — Brand Mention Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}%`,
                PROVIDER_LABELS[name] ?? name,
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              formatter={(value: string) => PROVIDER_LABELS[value] ?? value}
            />
            {providerList.map((provider) => (
              <Line
                key={provider}
                type="monotone"
                dataKey={provider}
                stroke={PROVIDER_COLORS[provider] ?? "#888"}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
