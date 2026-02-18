"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ScoreCardProps {
  score: {
    overall: number;
    grade: string;
    breakdown: {
      llmMentions: number;
      aiSearch: number;
      shareOfVoice: number;
      backlinkAuthority: number;
    };
    meta: {
      totalChecks: number;
      llmChecks: number;
      aiModeChecks: number;
      referringDomains: number;
    };
  } | null;
  isLoading: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-500/10 text-green-700 border-green-500/20",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  C: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  D: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  F: "bg-red-500/10 text-red-700 border-red-500/20",
};

const BREAKDOWN_ITEMS = [
  { key: "llmMentions" as const, label: "LLM Mentions", max: 40 },
  { key: "aiSearch" as const, label: "AI Search", max: 30 },
  { key: "shareOfVoice" as const, label: "Share of Voice", max: 20 },
  { key: "backlinkAuthority" as const, label: "Backlinks", max: 10 },
];

export function AIVisibilityScoreCard({ score, isLoading }: ScoreCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Visibility Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Visibility Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run visibility checks to compute your AI Visibility Score.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Visibility Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* Score circle */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20">
              <span className="text-2xl font-bold">{score.overall}</span>
            </div>
            <Badge
              variant="outline"
              className={GRADE_COLORS[score.grade] ?? ""}
            >
              Grade {score.grade}
            </Badge>
          </div>

          {/* Breakdown bars */}
          <div className="flex-1 space-y-3">
            {BREAKDOWN_ITEMS.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {score.breakdown[item.key]}/{item.max}
                  </span>
                </div>
                <Progress
                  value={(score.breakdown[item.key] / item.max) * 100}
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-4 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span>{score.meta.totalChecks} checks</span>
          <span>{score.meta.aiModeChecks} AI search checks</span>
          <span>{score.meta.referringDomains} referring domains</span>
        </div>
      </CardContent>
    </Card>
  );
}
