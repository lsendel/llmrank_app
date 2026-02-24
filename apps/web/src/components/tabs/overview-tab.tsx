"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { Brain, CheckCircle, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type CrawlJob,
  type CrawlInsights,
  type PageIssue,
  type ProjectProgress,
} from "@/lib/api";
import { AiInsightCard } from "@/components/narrative/ai-insight-card";
import { IntegrationInsightsCards } from "@/components/integration-insights-cards";
import { PlatformReadinessBadges } from "@/components/platform-readiness-badges";
import { PlatformOpportunityCards } from "@/components/platform-opportunity-cards";
import { AIAuditCard } from "@/components/visibility/ai-audit-card";
import { IntegrationPromptBanner } from "@/components/integration-prompt-banner";
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

    // If crawling/scoring, show progress
    if (
      latestCrawl?.status === "crawling" ||
      latestCrawl?.status === "scoring" ||
      latestCrawl?.status === "pending"
    ) {
      return (
        <StateCard
          variant="loading"
          title="Crawl in progress"
          description={
            <>
              We are scanning your site now. You can follow detailed progress on
              the{" "}
              <Link
                href={`/dashboard/crawl/${latestCrawl.id}`}
                className="text-primary hover:underline"
              >
                crawl page
              </Link>
              .
            </>
          }
          contentClassName="p-0"
        />
      );
    }

    return (
      <>
        {isFailed ? (
          <StateCard
            variant="error"
            title="Last crawl failed"
            description={
              <>
                {latestCrawl?.errorMessage && (
                  <>
                    {latestCrawl.errorMessage}
                    <br />
                  </>
                )}
                Click &quot;Run Crawl&quot; to try again.
              </>
            }
            contentClassName="p-0"
          />
        ) : (
          <StateCard
            variant="empty"
            description='No crawl data yet. Click "Run Crawl" to analyze this site.'
            contentClassName="p-0"
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Export + Regression alert */}
      <div className="flex items-center justify-between">
        <RegressionAlert projectId={projectId} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => api.exports.download(projectId, "csv")}
            >
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => api.exports.download(projectId, "json")}
            >
              Export JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Integration Prompt */}
      <IntegrationPromptBanner projectId={projectId} />

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
                  <AiReadinessChecklist
                    issues={issues}
                    siteContext={latestCrawl?.summaryData?.siteContext}
                  />
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

      {/* AI Insight Card (Pro/Agency) */}
      {latestCrawl?.id && (
        <AiInsightCard crawlJobId={latestCrawl.id} projectId={projectId} />
      )}

      {/* AI Crawlability Audit */}
      {latestCrawl?.id && <AIAuditCard crawlId={latestCrawl.id} />}

      {/* Score Trends */}
      <ScoreTrendChart projectId={projectId} />

      {/* Progress Since Last Crawl */}
      <ProjectProgressCard projectId={projectId} />

      {/* Integration Insights */}
      <IntegrationInsightsCards projectId={projectId} />

      {/* Platform Readiness (compact badges — full matrix in Visibility tab) */}
      {latestCrawl?.id && <PlatformReadinessBadges crawlId={latestCrawl.id} />}

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
            href={`/dashboard/projects/${projectId}?tab=pages`}
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
              href={`/dashboard/projects/${projectId}?tab=issues`}
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
import { SiteContext } from "@/lib/api";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function AiReadinessChecklist({
  issues,
  siteContext,
}: {
  issues: PageIssue[];
  siteContext?: SiteContext;
}) {
  const issueCodes = new Set(issues.map((i) => i.code));

  const factors = [
    {
      code: "MISSING_LLMS_TXT",
      label: "llms.txt file",
      pass: siteContext
        ? siteContext.hasLlmsTxt
        : !issueCodes.has("MISSING_LLMS_TXT"),
    },
    {
      code: "AI_CRAWLER_BLOCKED",
      label: "AI crawlers allowed",
      pass: siteContext
        ? siteContext.aiCrawlersBlocked.length === 0
        : !issueCodes.has("AI_CRAWLER_BLOCKED"),
      details:
        siteContext && siteContext.aiCrawlersBlocked.length > 0
          ? `Blocked: ${siteContext.aiCrawlersBlocked.join(", ")}`
          : undefined,
    },
    {
      code: "NO_SITEMAP",
      label: "Sitemap found",
      pass: siteContext
        ? siteContext.hasSitemap
        : !issueCodes.has("NO_SITEMAP"),
      details: siteContext?.sitemapAnalysis
        ? `${siteContext.sitemapAnalysis.urlCount} URLs`
        : undefined,
    },
    {
      code: "CITATION_WORTHINESS",
      label: "Citation-worthy content",
      pass: !issueCodes.has("CITATION_WORTHINESS"),
    },
  ];

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
      {factors.map((factor) => (
        <div key={factor.label} className="flex items-center gap-1.5 text-xs">
          {factor.pass ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-600" />
          )}
          <span
            className={
              factor.pass ? "text-foreground" : "text-muted-foreground"
            }
          >
            {factor.label}
          </span>
          {factor.details && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{factor.details}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ))}
    </div>
  );
}
