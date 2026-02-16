"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type FusedInsights } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";

function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function PlatformOpportunityCards({ crawlId }: { crawlId: string }) {
  const { data: fused } = useApiSWR<FusedInsights>(
    `fused-insights-${crawlId}`,
    useCallback(() => api.crawls.fusedInsights(crawlId), [crawlId]),
  );

  if (!fused) return null;

  const { platformOpportunities, contentHealthMatrix } = fused;

  return (
    <div className="space-y-6">
      {/* Platform Opportunities */}
      {platformOpportunities.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformOpportunities.map((opp) => (
            <Card key={opp.platform}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">
                  {opp.platform}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      gradeColor(opp.currentScore),
                    )}
                  >
                    {opp.currentScore}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                  {opp.opportunityScore > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{opp.opportunityScore} potential
                    </Badge>
                  )}
                </div>

                {opp.visibilityRate !== null && (
                  <p className="text-xs text-muted-foreground">
                    Visibility:{" "}
                    <span className="font-medium text-foreground">
                      {(opp.visibilityRate * 100).toFixed(0)}%
                    </span>
                  </p>
                )}

                {opp.topTips.length > 0 && (
                  <ul className="space-y-1">
                    {opp.topTips.slice(0, 3).map((tip, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground flex gap-1.5"
                      >
                        <span className="text-primary shrink-0">-</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content Health Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                { key: "scoring", label: "Scoring Quality" },
                { key: "llmQuality", label: "LLM Quality" },
                { key: "engagement", label: "Engagement" },
                { key: "uxQuality", label: "UX Quality" },
              ] as const
            ).map(({ key, label }) => {
              const value = contentHealthMatrix[key];
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border p-3 text-center"
                >
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  {value !== null ? (
                    <>
                      <p className={cn("text-xl font-bold", gradeColor(value))}>
                        {value.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {scoreGrade(value)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">--</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
