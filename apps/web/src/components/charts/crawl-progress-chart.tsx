"use client";

import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

const COLORS = {
  scored: "hsl(142, 71%, 45%)",
  crawled: "hsl(217, 91%, 60%)",
  pending: "hsl(var(--muted))",
  errored: "hsl(0, 84%, 60%)",
};

interface Props {
  found: number;
  crawled: number;
  scored: number;
  errored: number;
  status: string;
}

export const CrawlProgressChart = memo(function CrawlProgressChart({
  found,
  crawled,
  scored,
  errored,
  status,
}: Props) {
  const pending = Math.max(0, found - crawled);
  const crawledNotScored = Math.max(0, crawled - scored - errored);
  const isActive = status !== "complete" && status !== "failed";

  const data = [
    { name: "Scored", value: scored },
    { name: "Crawled", value: crawledNotScored },
    { name: "Pending", value: pending },
    { name: "Errored", value: errored },
  ].filter((d) => d.value > 0);

  const colorMap: Record<string, string> = {
    Scored: COLORS.scored,
    Crawled: COLORS.crawled,
    Pending: COLORS.pending,
    Errored: COLORS.errored,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          Crawl Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorMap[entry.name] ?? "#888"} />
              ))}
            </Pie>
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              className="fill-foreground text-2xl font-bold"
            >
              {scored}/{found}
            </text>
            <text
              x="50%"
              y="56%"
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              scored
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});
