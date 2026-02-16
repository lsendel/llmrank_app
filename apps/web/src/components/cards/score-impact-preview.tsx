"use client";

import { ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ScoreImpactPreviewProps {
  currentScore: number;
  currentGrade: string;
  predictedScore: number;
  predictedGrade: string;
  delta: number;
  label?: string;
}

function gradeColor(grade: string) {
  switch (grade) {
    case "A":
      return "text-green-600";
    case "B":
      return "text-blue-600";
    case "C":
      return "text-yellow-600";
    case "D":
      return "text-orange-600";
    default:
      return "text-red-600";
  }
}

export function ScoreImpactPreview({
  currentScore,
  currentGrade,
  predictedScore,
  predictedGrade,
  delta,
  label = "Completing all remaining items could improve your score",
}: ScoreImpactPreviewProps) {
  if (delta <= 0) return null;

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardContent className="flex items-center gap-4 py-4">
        <TrendingUp className="h-5 w-5 shrink-0 text-green-600" />
        <div className="flex flex-1 items-center gap-3">
          <div className="text-center">
            <div className={`text-2xl font-bold ${gradeColor(currentGrade)}`}>
              {currentGrade}
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(currentScore)}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-center">
            <div className={`text-2xl font-bold ${gradeColor(predictedGrade)}`}>
              {predictedGrade}
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(predictedScore)}
            </div>
          </div>
          <div className="ml-2 text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
          +{Math.round(delta)} pts
        </div>
      </CardContent>
    </Card>
  );
}
