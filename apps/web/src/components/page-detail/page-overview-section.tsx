"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreCircle } from "@/components/score-circle";
import { ScoreRadarChart } from "@/components/charts/score-radar-chart";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import type { PageScoreDetail } from "@/lib/api";

interface PageOverviewSectionProps {
  page: PageScoreDetail;
}

export function PageOverviewSection({ page }: PageOverviewSectionProps) {
  const detail = page.score?.detail ?? {};

  return (
    <div className="space-y-6">
      {page.score ? (
        <div className="grid gap-6 lg:grid-cols-[auto_auto_1fr]">
          <Card className="flex items-center justify-center p-8">
            <ScoreCircle
              score={page.score.overallScore}
              size={160}
              label="Overall Score"
            />
          </Card>
          <ScoreRadarChart
            technical={page.score.technicalScore ?? 0}
            content={page.score.contentScore ?? 0}
            aiReadiness={page.score.aiReadinessScore ?? 0}
            performance={(detail.performanceScore as number) ?? null}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                {
                  label: "Technical SEO",
                  score: page.score.technicalScore,
                },
                {
                  label: "Content Quality",
                  score: page.score.contentScore,
                },
                {
                  label: "AI Readiness",
                  score: page.score.aiReadinessScore,
                },
                {
                  label: "Performance",
                  score: (detail.performanceScore as number) ?? null,
                },
              ].map((cat) => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{cat.label}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        cat.score != null ? gradeColor(cat.score) : "",
                      )}
                    >
                      {cat.score != null
                        ? `${Math.round(cat.score)} / 100`
                        : "--"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        cat.score != null
                          ? scoreBarColor(cat.score)
                          : "bg-muted",
                      )}
                      style={{ width: `${cat.score ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No score data available.</p>
        </Card>
      )}

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Status Code</p>
            <p className="text-2xl font-bold">
              <Badge
                variant={page.statusCode === 200 ? "success" : "destructive"}
              >
                {page.statusCode ?? "--"}
              </Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Word Count</p>
            <p className="text-2xl font-bold">{page.wordCount ?? "--"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="text-sm font-medium truncate">{page.title ?? "--"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Grade</p>
            <p
              className={cn(
                "text-2xl font-bold",
                page.score ? gradeColor(page.score.overallScore) : "",
              )}
            >
              {page.score?.letterGrade ?? "--"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
