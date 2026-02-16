"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  avgWordCount: number;
  pagesAboveThreshold: number;
  totalPages: number;
  avgHtmlToTextRatio?: number;
  totalTextLength?: number;
  totalHtmlLength?: number;
}

export function ContentRatioGauge({
  avgWordCount,
  pagesAboveThreshold,
  totalPages,
  avgHtmlToTextRatio,
  totalTextLength,
  totalHtmlLength,
}: Props) {
  const percentage =
    totalPages > 0 ? Math.round((pagesAboveThreshold / totalPages) * 100) : 0;

  // Half-circle gauge via SVG arc
  const radius = 70;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80
      ? "stroke-green-500"
      : percentage >= 50
        ? "stroke-amber-400"
        : "stroke-red-500";

  const textColor =
    percentage >= 80
      ? "text-green-500"
      : percentage >= 50
        ? "text-amber-400"
        : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Content Depth
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Background arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {/* Foreground arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn(color, "transition-all duration-1000")}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="-mt-6 text-center">
          <span className={cn("text-3xl font-bold", textColor)}>
            {percentage}%
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            pages with 300+ words
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <div>
          Avg. {Math.round(avgWordCount).toLocaleString()} words per page
        </div>
        {avgHtmlToTextRatio != null && (
          <div>Text-to-HTML ratio {avgHtmlToTextRatio.toFixed(1)}%</div>
        )}
        {totalTextLength != null && totalHtmlLength != null && (
          <div>
            Text {totalTextLength.toLocaleString()} chars · HTML{" "}
            {totalHtmlLength.toLocaleString()} chars
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
