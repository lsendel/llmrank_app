"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { api, type PlatformReadinessResult } from "@/lib/api";

const PLATFORM_ICONS: Record<string, string> = {
  ChatGPT: "🤖",
  Claude: "🟠",
  Perplexity: "🔍",
  Gemini: "💎",
};

function passRate(checks: PlatformReadinessResult["checks"]): number {
  if (checks.length === 0) return 0;
  return Math.round(
    (checks.filter((c) => c.pass).length / checks.length) * 100,
  );
}

function passRateColor(rate: number): string {
  if (rate >= 80) return "text-success";
  if (rate >= 60) return "text-warning";
  return "text-destructive";
}

export function PlatformReadinessMatrix({ crawlId }: { crawlId: string }) {
  const { withToken } = useApi();
  const [matrix, setMatrix] = useState<PlatformReadinessResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    withToken((token) => api.platformReadiness.get(token, crawlId))
      .then(setMatrix)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [withToken, crawlId]);

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

  if (matrix.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          AI Platform Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-3 pr-4 text-left font-medium text-muted-foreground">
                  Check
                </th>
                {matrix.map((platform) => (
                  <th
                    key={platform.platform}
                    className="pb-3 px-3 text-center font-medium"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{PLATFORM_ICONS[platform.platform] ?? "🔹"}</span>
                      <span className="text-xs">{platform.platform}</span>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          passRateColor(passRate(platform.checks)),
                        )}
                      >
                        {passRate(platform.checks)}%
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Gather all unique factors across platforms */}
              {getAllFactors(matrix).map((factor) => (
                <tr key={factor} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {getLabelForFactor(matrix, factor)}
                  </td>
                  {matrix.map((platform) => {
                    const check = platform.checks.find(
                      (c) => c.factor === factor,
                    );
                    return (
                      <td
                        key={platform.platform}
                        className="py-2.5 px-3 text-center"
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
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-success" /> Pass
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-destructive" /> Critical fail
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-warning" /> Needs attention
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getAllFactors(matrix: PlatformReadinessResult[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const platform of matrix) {
    for (const check of platform.checks) {
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
