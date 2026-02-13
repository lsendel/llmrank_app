"use client";

import { useEffect, useState } from "react";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { api, type QuickWin } from "@/lib/api";

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Quick Fix", color: "bg-success/10 text-success" },
  medium: { label: "Moderate", color: "bg-warning/10 text-warning" },
  high: { label: "Significant", color: "bg-destructive/10 text-destructive" },
};

export function QuickWinsCard({ crawlId }: { crawlId: string }) {
  const { withToken } = useApi();
  const [wins, setWins] = useState<QuickWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  useEffect(() => {
    withToken((token) => api.quickWins.get(token, crawlId))
      .then(setWins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [withToken, crawlId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-warning" />
            Quick Wins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (wins.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-warning" />
          Quick Wins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {wins.map((win, i) => {
          const effort = EFFORT_LABELS[win.effortLevel] ?? EFFORT_LABELS.medium;
          const isExpanded = expandedCode === win.code;

          return (
            <div
              key={win.code}
              className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/30"
              onClick={() => setExpandedCode(isExpanded ? null : win.code)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{win.message}</span>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", effort.color)}
                    >
                      {effort.label}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      +{Math.abs(win.scoreImpact)} pts
                    </Badge>
                    {win.affectedPages > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {win.affectedPages} pages
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {win.recommendation}
                  </p>
                  {isExpanded && win.implementationSnippet && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      <code>{win.implementationSnippet}</code>
                    </pre>
                  )}
                </div>
                {win.implementationSnippet && (
                  <div className="flex-shrink-0 text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
