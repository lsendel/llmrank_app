"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { Brain, CheckCircle, XCircle } from "lucide-react";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type CrawlJob,
  type CrawlInsights,
  type PageIssue,
  type ProjectProgress,
} from "@/lib/api";
import { IntegrationInsightsCards } from "@/components/integration-insights-cards";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { PlatformOpportunityCards } from "@/components/platform-opportunity-cards";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { ProjectProgressCard } from "@/components/cards/project-progress-card";
import { RegressionAlert } from "@/components/cards/regression-alert";

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

  const { data: progress } = useApiSWR<ProjectProgress | null>(
    `progress-${projectId}`,
    useCallback(() => api.projects.progress(projectId), [projectId]),
  );

  const [_sitemapContent, _setSitemapContent] = useState<string | null>(null);
  const [_llmsTxtContent, _setLlmsTxtContent] = useState<string | null>(null);

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
      {/* Regression alert banner */}
      <RegressionAlert projectId={projectId} />

      {/* Hero section with ScoreCircle */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle
            score={latestCrawl!.overallScore ?? 0}
            size={160}
            label="Overall Score"
          />
        </Card>

        {/* Category breakdown — AI Readiness featured */}
        <div className="space-y-4">
          {/* Featured AI Readiness card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">AI Readiness</h3>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-xl font-bold",
                          gradeColor(latestCrawl!.scores!.aiReadiness),
                        )}
                      >
                        {latestCrawl!.scores!.aiReadiness}/100
                      </span>
                      {progress?.categoryDeltas.aiReadiness.delta !==
                        undefined &&
                        progress.categoryDeltas.aiReadiness.delta !== 0 && (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              progress.categoryDeltas.aiReadiness.delta > 0
                                ? "text-green-600"
                                : "text-red-600",
                            )}
                          >
                            {progress.categoryDeltas.aiReadiness.delta > 0
                              ? "+"
                              : ""}
                            {progress.categoryDeltas.aiReadiness.delta.toFixed(
                              0,
                            )}
                          </span>
                        )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    How well AI assistants can understand, cite, and recommend
                    your content
                  </p>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        scoreBarColor(latestCrawl!.scores!.aiReadiness),
                      )}
                      style={{
                        width: `${latestCrawl!.scores!.aiReadiness}%`,
                      }}
                    />
                  </div>
                  {/* AI-specific factor checklist */}
                  <AiReadinessChecklist issues={issues} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Other Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                {
                  key: "technical" as const,
                  label: "Technical SEO (25%)",
                  score: latestCrawl!.scores!.technical,
                },
                {
                  key: "content" as const,
                  label: "Content Quality (30%)",
                  score: latestCrawl!.scores!.content,
                },
                {
                  key: "performance" as const,
                  label: "Performance (15%)",
                  score: latestCrawl!.scores!.performance,
                },
              ].map((cat) => {
                const delta = progress?.categoryDeltas[cat.key]?.delta;
                return (
                  <div key={cat.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.label}</span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn("font-semibold", gradeColor(cat.score))}
                        >
                          {cat.score} / 100
                        </span>
                        {delta !== undefined && delta !== 0 && (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              delta > 0 ? "text-green-600" : "text-red-600",
                            )}
                          >
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(0)}
                          </span>
                        )}
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
                );
              })}
            </CardContent>
          </Card>
        </div>
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

      {/* Score Trends */}
      <ScoreTrendChart projectId={projectId} />

      {/* Progress Since Last Crawl */}
      <ProjectProgressCard projectId={projectId} />

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

// AI readiness factor checklist — shows pass/fail for key AI-specific factors
const AI_FACTORS = [
  { code: "MISSING_LLMS_TXT", label: "llms.txt file" },
  { code: "AI_CRAWLER_BLOCKED", label: "AI crawlers allowed" },
  { code: "NO_STRUCTURED_DATA", label: "Structured data" },
  { code: "CITATION_WORTHINESS", label: "Citation-worthy content" },
] as const;

function AiReadinessChecklist({ issues }: { issues: PageIssue[] }) {
  const issueCodes = new Set(issues.map((i) => i.code));
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
      {AI_FACTORS.map((factor) => {
        // AI_CRAWLER_BLOCKED is inverted: the factor label says "allowed", so issue present = fail
        const hasProblem = issueCodes.has(factor.code);
        const pass = !hasProblem;
        return (
          <div key={factor.code} className="flex items-center gap-1.5 text-xs">
            {pass ? (
              <CheckCircle className="h-3.5 w-3.5 text-success" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={pass ? "text-foreground" : "text-muted-foreground"}
            >
              {factor.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
