"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PlatformReadinessResult } from "@/lib/api";

const PLATFORM_ICONS: Record<string, string> = {
  ChatGPT: "🤖",
  Claude: "🟠",
  Perplexity: "🔍",
  Gemini: "💎",
};

function passRateColor(rate: number): string {
  if (rate >= 80) return "text-success";
  if (rate >= 60) return "text-warning";
  return "text-destructive";
}

export function PlatformReadinessMatrix({ crawlId }: { crawlId: string }) {
  const { data: matrix, isLoading: loading } = useApiSWR(
    `platform-readiness-${crawlId}`,
    useCallback(() => api.platformReadiness.get(crawlId), [crawlId]),
  );

  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            AI Platform Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!matrix || matrix.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Platform Score Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {matrix.map((platform) => (
          <Card
            key={platform.platform}
            className={cn(
              "relative overflow-hidden transition-all border-t-4",
              platform.score >= 80
                ? "border-t-success"
                : platform.score >= 60
                  ? "border-t-warning"
                  : "border-t-destructive",
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span>{PLATFORM_ICONS[platform.platform] ?? "🤖"}</span>
                  {platform.platform}
                </CardTitle>
                <div className="flex flex-col items-end">
                  <span
                    className={cn(
                      "text-xl font-bold",
                      passRateColor(platform.score),
                    )}
                  >
                    {platform.score}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Grade {platform.grade}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {platform.tips?.[0] && (
                <div className="text-xs text-muted-foreground line-clamp-2 italic">
                  &ldquo;{platform.tips[0]}&rdquo;
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[10px] gap-1"
                onClick={() =>
                  setExpandedPlatform(
                    expandedPlatform === platform.platform
                      ? null
                      : platform.platform,
                  )
                }
              >
                {expandedPlatform === platform.platform ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Hide Tips
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> View All Tips
                  </>
                )}
              </Button>

              {expandedPlatform === platform.platform &&
                platform.tips?.length > 0 && (
                  <ul className="space-y-1.5 pt-2 border-t">
                    {platform.tips.map((tip, i) => (
                      <li key={i} className="text-[10px] flex gap-1.5">
                        <Info className="h-3 w-3 shrink-0 text-primary" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Factor Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            AI Readiness Factor Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pr-4 text-left font-medium text-muted-foreground">
                    Ranking Factor
                  </th>
                  {matrix.map((platform) => (
                    <th
                      key={platform.platform}
                      className="px-3 pb-3 text-center font-medium"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span title={platform.platform}>
                          {PLATFORM_ICONS[platform.platform] ?? "🔹"}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {platform.platform.substring(0, 3)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getAllFactors(matrix).map((factor) => (
                  <tr key={factor} className="border-b last:border-0 group">
                    <td className="py-2.5 pr-4 text-muted-foreground group-hover:text-foreground transition-colors">
                      {getLabelForFactor(matrix, factor)}
                    </td>
                    {matrix.map((platform) => {
                      const check = platform.checks.find(
                        (c) => c.factor === factor,
                      );
                      return (
                        <td
                          key={platform.platform}
                          className="px-3 py-2.5 text-center"
                        >
                          {check ? (
                            check.pass ? (
                              <CheckCircle className="mx-auto h-4 w-4 text-success" />
                            ) : check.importance === "critical" ? (
                              <XCircle className="mx-auto h-4 w-4 text-destructive" />
                            ) : (
                              <AlertTriangle className="mx-auto h-4 w-4 text-warning" />
                            )
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase font-semibold text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-success" /> Optimized
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" /> Critical Gap
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-warning" /> Improvement
              Needed
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getAllFactors(matrix: PlatformReadinessResult[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const platform of matrix) {
    for (const check of platform.checks ?? []) {
      if (!seen.has(check.factor)) {
        seen.add(check.factor);
        ordered.push(check.factor);
      }
    }
  }
  return ordered;
}

function getLabelForFactor(
  matrix: PlatformReadinessResult[],
  factor: string,
): string {
  for (const platform of matrix) {
    const check = platform.checks.find((c) => c.factor === factor);
    if (check) return check.label;
  }
  return factor;
}
