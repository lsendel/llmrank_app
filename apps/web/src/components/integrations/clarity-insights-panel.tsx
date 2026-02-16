"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClarityData {
  avgUxScore: number;
  rageClickPages: string[];
}

function uxScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-destructive";
}

export function ClarityInsightsPanel({ data }: { data: ClarityData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Microsoft Clarity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* UX Score */}
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p
              className={cn(
                "text-5xl font-bold",
                uxScoreColor(data.avgUxScore),
              )}
            >
              {data.avgUxScore.toFixed(0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">UX Score / 100</p>
          </div>
        </div>

        {/* Rage Click Pages */}
        <div>
          <p className="text-sm font-medium mb-2">
            Rage Click Pages ({data.rageClickPages.length})
          </p>
          {data.rageClickPages.length > 0 ? (
            <ul className="space-y-1.5">
              {data.rageClickPages.map((page) => (
                <li
                  key={page}
                  className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                  <span className="truncate" title={page}>
                    {page}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No rage clicks detected.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
