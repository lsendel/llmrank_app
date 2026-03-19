import dynamic from "next/dynamic";
import Link from "next/link";
import { AiInsightCard } from "@/components/narrative/ai-insight-card";
import { ProjectProgressCard } from "@/components/cards/project-progress-card";
import { RegressionAlert } from "@/components/cards/regression-alert";

const GradeDistributionChart = dynamic(
  () =>
    import("@/components/charts/grade-distribution-chart").then((m) => ({
      default: m.GradeDistributionChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg bg-muted/30" />
    ),
  },
);
const IssueDistributionChart = dynamic(
  () =>
    import("@/components/charts/issue-distribution-chart").then((m) => ({
      default: m.IssueDistributionChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg bg-muted/30" />
    ),
  },
);
const ScoreTrendChart = dynamic(
  () =>
    import("@/components/charts/score-trend-chart").then((m) => ({
      default: m.ScoreTrendChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg bg-muted/30" />
    ),
  },
);
import { IntegrationInsightsCards } from "@/components/integration-insights-cards";
import { IssueCard } from "@/components/issue-card";
import { PlatformOpportunityCards } from "@/components/platform-opportunity-cards";
import { PlatformReadinessBadges } from "@/components/platform-readiness-badges";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateCard } from "@/components/ui/state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AIAuditCard } from "@/components/visibility/ai-audit-card";
import {
  type CrawlInsights,
  type CrawlJob,
  type PageIssue,
  type ProjectProgress,
  type SiteContext,
} from "@/lib/api";
import { relativeTimeLabel } from "@/lib/insight-metadata";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import {
  Brain,
  CheckCircle,
  Download,
  Info,
  Play,
  XCircle,
} from "lucide-react";
import {
  buildAiReadinessFactors,
  buildOtherCategoryRows,
  type OverviewStatusState,
} from "./overview-tab-helpers";

export function OverviewStatusStateCard({
  state,
}: {
  state: Exclude<OverviewStatusState, null>;
}) {
  if (state.kind === "loading") {
    return (
      <StateCard
        variant="loading"
        title="Crawl in progress"
        description={
          <>
            We are scanning your site now. You can follow detailed progress on
            the{" "}
            <Link
              href={`/dashboard/crawl/${state.crawlId}`}
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

  if (state.kind === "error") {
    return (
      <StateCard
        variant="error"
        title="Last crawl failed"
        description={
          <>
            {state.errorMessage && (
              <>
                {state.errorMessage}
                <br />
              </>
            )}
            Click &quot;Run Crawl&quot; to try again.
          </>
        }
        contentClassName="p-0"
      />
    );
  }

  return (
    <StateCard
      variant="empty"
      description='No crawl data yet. Click "Run Crawl" to analyze this site.'
      contentClassName="p-0"
    />
  );
}

export function OverviewToolbar({
  projectId,
  onStartCrawl,
  startingCrawl,
  onExportCsv,
  onExportJson,
}: {
  projectId: string;
  onStartCrawl?: () => void;
  startingCrawl?: boolean;
  onExportCsv: () => void;
  onExportJson: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <RegressionAlert projectId={projectId} />
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCsv}>
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJson}>
              Export JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onStartCrawl && (
          <Button size="sm" onClick={onStartCrawl} disabled={startingCrawl}>
            <Play className="mr-1.5 h-4 w-4" />
            {startingCrawl ? "Starting..." : "Run crawl now"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function OverviewFreshnessSummary({
  crawlTimestamp,
  pagesSampled,
  dataConfidence,
  crawlId,
}: {
  crawlTimestamp: string | null;
  pagesSampled: number;
  dataConfidence: ReturnType<
    typeof import("@/lib/insight-metadata").confidenceFromPageSample
  >;
  crawlId: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">
        Last analyzed: {relativeTimeLabel(crawlTimestamp)}
      </Badge>
      <Badge variant="secondary">Pages sampled: {pagesSampled}</Badge>
      <Badge variant={dataConfidence.variant}>
        Confidence: {dataConfidence.label}
      </Badge>
      {crawlId && <Badge variant="outline">Crawl: {crawlId.slice(0, 8)}</Badge>}
    </div>
  );
}

export function OverviewHeroSection({
  latestCrawl,
  progress,
  issues,
}: {
  latestCrawl: CrawlJob;
  progress?: ProjectProgress | null;
  issues: PageIssue[];
}) {
  const aiReadinessDelta = progress?.categoryDeltas.aiReadiness.delta;
  const otherCategories = buildOtherCategoryRows(latestCrawl, progress);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card className="flex items-center justify-center p-8">
        <ScoreCircle
          score={latestCrawl.overallScore ?? 0}
          size={160}
          label="Overall Score"
        />
      </Card>

      <div className="space-y-4">
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
                        gradeColor(latestCrawl.scores!.aiReadiness),
                      )}
                    >
                      {latestCrawl.scores!.aiReadiness}/100
                    </span>
                    {aiReadinessDelta !== undefined &&
                      aiReadinessDelta !== 0 && (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            aiReadinessDelta > 0
                              ? "text-green-600"
                              : "text-red-600",
                          )}
                        >
                          {aiReadinessDelta > 0 ? "+" : ""}
                          {aiReadinessDelta.toFixed(0)}
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
                      scoreBarColor(latestCrawl.scores!.aiReadiness),
                    )}
                    style={{ width: `${latestCrawl.scores!.aiReadiness}%` }}
                  />
                </div>
                <AiReadinessChecklist
                  issues={issues}
                  siteContext={latestCrawl.summaryData?.siteContext}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {otherCategories.map((category) => (
              <div key={category.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{category.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-semibold",
                        category.score != null
                          ? gradeColor(category.score)
                          : "text-muted-foreground",
                      )}
                    >
                      {category.score != null
                        ? `${category.score} / 100`
                        : "N/A"}
                    </span>
                    {category.delta !== undefined && category.delta !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          category.delta > 0
                            ? "text-green-600"
                            : "text-red-600",
                        )}
                      >
                        {category.delta > 0 ? "+" : ""}
                        {category.delta.toFixed(0)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {category.score != null && (
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        scoreBarColor(category.score),
                      )}
                      style={{ width: `${category.score}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiReadinessChecklist({
  issues,
  siteContext,
}: {
  issues: PageIssue[];
  siteContext?: SiteContext;
}) {
  const factors = buildAiReadinessFactors(issues, siteContext);

  return (
    <TooltipProvider>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{factor.details}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

export function OverviewExecutiveSummary({
  summary,
}: {
  summary?: string | null;
}) {
  if (!summary) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewSupportingSections({
  latestCrawl,
  projectId,
  insights,
}: {
  latestCrawl: CrawlJob;
  projectId: string;
  insights?: CrawlInsights;
}) {
  return (
    <>
      {latestCrawl.id && (
        <AiInsightCard crawlJobId={latestCrawl.id} projectId={projectId} />
      )}
      {latestCrawl.id && <AIAuditCard crawlId={latestCrawl.id} />}
      <ScoreTrendChart projectId={projectId} />
      <ProjectProgressCard projectId={projectId} />
      <IntegrationInsightsCards projectId={projectId} />
      {latestCrawl.id && <PlatformReadinessBadges crawlId={latestCrawl.id} />}
      {latestCrawl.id && <PlatformOpportunityCards crawlId={latestCrawl.id} />}

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

      {latestCrawl.id && (
        <QuickWinsCard crawlId={latestCrawl.id} projectId={projectId} />
      )}

      {latestCrawl.status === "complete" && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/projects/${projectId}?tab=pages`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View All Pages →
          </Link>
        </div>
      )}
    </>
  );
}

export function OverviewTopIssuesSection({
  issues,
  projectId,
}: {
  issues: PageIssue[];
  projectId: string;
}) {
  if (issues.length === 0) return null;

  return (
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
  );
}
