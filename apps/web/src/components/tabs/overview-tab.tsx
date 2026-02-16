"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { Brain } from "lucide-react";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type CrawlJob,
  type CrawlInsights,
  type PageIssue,
} from "@/lib/api";
import { IntegrationInsightsCards } from "@/components/integration-insights-cards";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { PlatformOpportunityCards } from "@/components/platform-opportunity-cards";

export function OverviewTab({
  latestCrawl,
  issues,
  projectId,
}: {
  latestCrawl: CrawlJob | null | undefined;
  issues: PageIssue[];
  projectId: string;
}) {
  const crawlId = latestCrawl?.id;
  const { data: insights } = useApiSWR<CrawlInsights>(
    crawlId ? `insights-${crawlId}` : null,
    useCallback(() => api.crawls.getInsights(crawlId!), [crawlId]),
  );

  const hasScores = latestCrawl?.scores != null;

  if (!hasScores) {
    const isFailed = latestCrawl?.status === "failed";
    return (
      <Card className="p-8 text-center">
        {isFailed ? (
          <div className="space-y-2">
            <p className="font-medium text-destructive">Last crawl failed</p>
            {latestCrawl?.errorMessage && (
              <p className="text-sm text-muted-foreground">
                {latestCrawl.errorMessage}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Click &quot;Run Crawl&quot; to try again.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No crawl data yet. Click &quot;Run Crawl&quot; to analyze this site.
          </p>
        )}
      </Card>
    );
  }

  return (
    <>
      {/* Hero section with ScoreCircle */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle
            score={latestCrawl!.overallScore ?? 0}
            size={160}
            label="Overall Score"
          />
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              {
                key: "technical",
                label: "Technical SEO",
                score: latestCrawl!.scores!.technical,
              },
              {
                key: "content",
                label: "Content Quality",
                score: latestCrawl!.scores!.content,
              },
              {
                key: "aiReadiness",
                label: "AI Readiness",
                score: latestCrawl!.scores!.aiReadiness,
              },
              {
                key: "performance",
                label: "Performance",
                score: latestCrawl!.scores!.performance,
              },
            ].map((cat) => (
              <div key={cat.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.label}</span>
                  <span className={cn("font-semibold", gradeColor(cat.score))}>
                    {cat.score} / 100
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      scoreBarColor(cat.score),
                    )}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Summary */}
      {latestCrawl?.summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">
              {latestCrawl.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Integration Insights */}
      <IntegrationInsightsCards projectId={projectId} />

      {/* Platform Readiness */}
      {latestCrawl?.id && <PlatformReadinessMatrix crawlId={latestCrawl.id} />}

      {/* Platform Opportunity + Content Health */}
      {latestCrawl?.id && <PlatformOpportunityCards crawlId={latestCrawl.id} />}

      {/* Insights Charts */}
      {insights && (
        <div className="grid gap-6 md:grid-cols-2">
          <IssueDistributionChart
            bySeverity={insights.issueDistribution.bySeverity}
            byCategory={insights.issueDistribution.byCategory}
            total={insights.issueDistribution.total}
          />
          <GradeDistributionChart grades={insights.gradeDistribution} />
        </div>
      )}

      {/* Quick Wins */}
      {latestCrawl?.id && (
        <QuickWinsCard crawlId={latestCrawl.id} projectId={projectId} />
      )}

      {/* View All Pages link */}
      {latestCrawl?.status === "complete" && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/projects/${projectId}/pages`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View All Pages →
          </Link>
        </div>
      )}

      {/* Top Issues */}
      {issues.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Issues</h2>
            <Link
              href={`/dashboard/projects/${projectId}/issues`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all issues
            </Link>
          </div>
          <div className="space-y-3">
            {issues.slice(0, 5).map((issue) => (
              <IssueCard key={issue.code} {...issue} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
