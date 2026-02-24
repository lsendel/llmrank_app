"use client";

import { useCallback, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type VisibilityGap } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { StateCard } from "@/components/ui/state";

export function ContentGapAnalysis({ projectId }: { projectId: string }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = useApiSWR<VisibilityGap[]>(
    `content-gaps-${projectId}`,
    useCallback(() => api.visibility.getGaps(projectId), [projectId]),
  );

  const gaps = data ?? [];

  if (isLoading) {
    return (
      <StateCard
        variant="loading"
        description="Analyzing competitor coverage gaps..."
      />
    );
  }

  if (gaps.length === 0) {
    return (
      <StateCard
        variant="empty"
        title="No content gaps found"
        icon={<Lightbulb className="h-5 w-5 text-muted-foreground" />}
        description="Run a visibility check with competitors to discover gaps."
      />
    );
  }

  // Gaps where competitors are cited but user isn't are highest priority
  const sorted = [...gaps].sort((a, b) => {
    const aPriority = !a.userCited && a.competitorsCited.length > 0 ? 0 : 1;
    const bPriority = !b.userCited && b.competitorsCited.length > 0 ? 0 : 1;
    return (
      aPriority - bPriority ||
      b.competitorsCited.length - a.competitorsCited.length
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Content Gaps (
          {
            gaps.filter((g) => !g.userCited && g.competitorsCited.length > 0)
              .length
          }
          )
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted
          .filter((g) => !g.userCited && g.competitorsCited.length > 0)
          .map((gap, i) => (
            <button
              key={i}
              className="w-full rounded-lg border p-3 text-left hover:bg-muted/50"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{gap.query}</span>
                <Badge
                  variant={
                    gap.competitorsCited.length >= 2 ? "destructive" : "warning"
                  }
                >
                  {gap.competitorsCited.length} competitor
                  {gap.competitorsCited.length !== 1 ? "s" : ""}
                </Badge>
                {expanded === i ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Checked on: {gap.providers.join(", ")}
              </p>
              {expanded === i && (
                <ul className="mt-2 space-y-1 border-t pt-2 text-sm">
                  {gap.competitorsCited.map((comp, j) => (
                    <li key={j} className="text-muted-foreground">
                      {comp.domain}
                      {comp.position != null && ` (position #${comp.position})`}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          ))}
      </CardContent>
    </Card>
  );
}
