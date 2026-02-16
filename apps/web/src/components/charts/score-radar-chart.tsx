"use client";

import { memo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crosshair } from "lucide-react";

interface Props {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  className?: string;
}

export const ScoreRadarChart = memo(function ScoreRadarChart({
  technical,
  content,
  aiReadiness,
  performance,
  className,
}: Props) {
  const data = [
    { dimension: "Technical", score: technical, fullMark: 100 },
    { dimension: "Content", score: content, fullMark: 100 },
    { dimension: "AI Ready", score: aiReadiness, fullMark: 100 },
    { dimension: "Perf", score: performance, fullMark: 100 },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="h-4 w-4" />
          Score Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={data}>
            <PolarGrid className="stroke-muted" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
            />
            <Radar
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              dot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
            <Tooltip
              formatter={(value: number) => [
                `${Math.round(value)} / 100`,
                "Score",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});
