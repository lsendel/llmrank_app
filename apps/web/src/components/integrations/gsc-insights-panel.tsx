"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GscQuery {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
}

type SortKey = "query" | "impressions" | "clicks" | "ctr" | "position";

export function GscInsightsPanel({
  data,
}: {
  data: { topQueries: GscQuery[] };
}) {
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);

  const queries = (data.topQueries ?? []).map((q) => ({
    ...q,
    ctr: q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0,
  }));

  const sorted = [...queries].sort((a, b) => {
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    if (typeof aVal === "string" && typeof bVal === "string")
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortAsc
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const chartData = [...queries]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map((q) => ({
      name: q.query.length > 20 ? q.query.slice(0, 18) + "..." : q.query,
      impressions: q.impressions,
      clicks: q.clicks,
    }));

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Search Console</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {chartData.length > 0 && (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip />
                <Bar
                  dataKey="impressions"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="clicks"
                  fill="hsl(var(--primary) / 0.4)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th
                  className="pb-2 pr-4 cursor-pointer select-none"
                  onClick={() => handleSort("query")}
                >
                  Query{sortArrow("query")}
                </th>
                <th
                  className="pb-2 pr-4 text-right cursor-pointer select-none"
                  onClick={() => handleSort("impressions")}
                >
                  Impressions{sortArrow("impressions")}
                </th>
                <th
                  className="pb-2 pr-4 text-right cursor-pointer select-none"
                  onClick={() => handleSort("clicks")}
                >
                  Clicks{sortArrow("clicks")}
                </th>
                <th
                  className="pb-2 pr-4 text-right cursor-pointer select-none"
                  onClick={() => handleSort("ctr")}
                >
                  CTR{sortArrow("ctr")}
                </th>
                <th
                  className="pb-2 text-right cursor-pointer select-none"
                  onClick={() => handleSort("position")}
                >
                  Avg Position{sortArrow("position")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => (
                <tr key={q.query} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{q.query}</td>
                  <td className="py-2 pr-4 text-right">
                    {q.impressions.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {q.clicks.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">{q.ctr.toFixed(1)}%</td>
                  <td className="py-2 text-right">{q.position.toFixed(1)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-muted-foreground"
                  >
                    No query data synced yet.
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
