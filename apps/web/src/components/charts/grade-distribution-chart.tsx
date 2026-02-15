"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "hsl(142, 71%, 45%)",
  B: "hsl(142, 50%, 55%)",
  C: "hsl(48, 96%, 53%)",
  D: "hsl(25, 95%, 53%)",
  F: "hsl(0, 84%, 60%)",
};

interface Props {
  grades: { grade: string; count: number; percentage: number }[];
}

export function GradeDistributionChart({ grades }: Props) {
  const total = grades.reduce((s, g) => s + g.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Grade Distribution
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {total} pages
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={grades} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="grade"
              tick={{ fontSize: 14, fontWeight: 600 }}
              width={30}
              className="fill-foreground"
            />
            <Tooltip
              formatter={(
                value: number,
                _name: string,
                props: { payload: { percentage: number } },
              ) => [`${value} pages (${props.payload.percentage}%)`, "Count"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
              {grades.map((entry) => (
                <Cell
                  key={entry.grade}
                  fill={GRADE_COLORS[entry.grade] ?? "#888"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
