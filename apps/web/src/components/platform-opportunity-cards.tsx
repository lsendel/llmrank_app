"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type FusedInsights } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";
import { platformDisplay } from "@/lib/platform-display";

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

  if (!fused) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Platform opportunity data will appear after your first crawl
          completes.
        </p>
      </div>
    );
  }

  const { platformOpportunities, contentHealthMatrix } = fused;

  return (
    <div className="space-y-6">
      {/* Platform Opportunities */}
      {platformOpportunities.length > 0 && (
        <TooltipProvider>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">AI Platform Readiness</h3>
              <p className="text-xs text-muted-foreground">
                How ready your content is for each AI assistant — scored out of
                100. &ldquo;+N potential&rdquo; is the headroom to a perfect
                score.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {platformOpportunities.map((opp) => {
                const { label, icon } = platformDisplay(opp.platform);
                return (
                  <Card key={opp.platform}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-1.5 text-sm">
                        <span aria-hidden>{icon}</span>
                        <span>{label}</span>
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
                        <span className="text-xs text-muted-foreground">
                          / 100
                        </span>
                        {opp.opportunityScore > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="cursor-help text-[10px]"
                              >
                                +{opp.opportunityScore} potential
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Points of headroom to a perfect 100 on {label}.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {opp.visibilityRate !== null && (
                        <p className="text-xs text-muted-foreground">
                          Visibility:{" "}
                          <span className="font-medium text-foreground">
                            {opp.visibilityRate === 0
                              ? "Not checked"
                              : `${(opp.visibilityRate * 100).toFixed(0)}%`}
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
                );
              })}
            </div>
          </div>
        </TooltipProvider>
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
                { key: "scoring", label: "Scoring Quality", nullLabel: "--" },
                {
                  key: "llmQuality",
                  label: "LLM Quality",
                  nullLabel: "Not yet assessed",
                },
                {
                  key: "engagement",
                  label: "Engagement",
                  nullLabel: "No traffic data",
                },
                {
                  key: "uxQuality",
                  label: "UX Quality",
                  nullLabel: "No session data",
                },
              ] as const
            ).map(({ key, label, nullLabel }) => {
              const value = contentHealthMatrix[key];
              // LLM content scoring is gated to the top-N pages per crawl, so
              // llmQuality is an average over only `llmScoredPages` of the crawl.
              // Surface that denominator so the number never reads as site-wide.
              const scored = contentHealthMatrix.llmScoredPages;
              const total = contentHealthMatrix.totalPages;
              const denominator =
                key === "llmQuality" && total > 0 && scored > 0
                  ? `top ${scored} of ${total} pages`
                  : null;
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
                        {denominator ?? scoreGrade(value)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{nullLabel}</p>
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
