"use client";

import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 84%, 60%)",
  warning: "hsl(38, 92%, 50%)",
  info: "hsl(217, 91%, 60%)",
};

interface Props {
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
  total: number;
}

export const IssueDistributionChart = memo(function IssueDistributionChart({
  bySeverity,
  byCategory,
  total,
}: Props) {
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Issue Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            No issues found — great job!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          Issue Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={bySeverity}
              dataKey="count"
              nameKey="severity"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              strokeWidth={2}
            >
              {bySeverity.map((entry) => (
                <Cell
                  key={entry.severity}
                  fill={SEVERITY_COLORS[entry.severity] ?? "#888"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              className="fill-foreground text-2xl font-bold"
            >
              {total}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              issues
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {bySeverity.find((s) => s.severity === "critical")?.count ?? 0} critical
        {" · "}
        {bySeverity.find((s) => s.severity === "warning")?.count ?? 0} warnings
        {" · "}
        {byCategory.length} categories affected
      </CardFooter>
    </Card>
  );
});
