"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  ExternalLink,
  Share2,
  Zap,
} from "lucide-react";
import { CrawlProgress, type CrawlStatus } from "@/components/crawl-progress";
import { CrawlProgressChart } from "@/components/charts/crawl-progress-chart";
import { PdfDownloadButton } from "@/components/report/pdf-download-button";
import { ScoreCircle } from "@/components/score-circle";
import { ShareModal } from "@/components/share/share-modal";
import { IssuesTab } from "@/components/tabs/issues-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrawlJob, PageIssue, QuickWin } from "@/lib/api";
import { cn, scoreColor } from "@/lib/utils";
import {
  CRAWL_DETAIL_SCORE_ITEMS,
  getCrawlStatusBadgeVariant,
  getCrawlSubtitle,
  getQuickWinOpportunityPoints,
  isCrawlerUnavailable,
} from "../crawl-detail-helpers";

interface CrawlDetailLayoutProps {
  crawlId: string;
  crawl: CrawlJob;
  quickWins?: QuickWin[];
  quickWinsLoading: boolean;
  issues?: PageIssue[];
  branding: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };
  shareOpen: boolean;
  onShareOpenChange: (open: boolean) => void;
}

function CrawlDetailHeader({ crawl }: Pick<CrawlDetailLayoutProps, "crawl">) {
  return (
    <div>
      <Link
        href={`/dashboard/projects/${crawl.projectId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Project
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crawl Details</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {getCrawlSubtitle(crawl)}
          </p>
        </div>
        <Badge variant={getCrawlStatusBadgeVariant(crawl.status)}>
          {crawl.status}
        </Badge>
      </div>
    </div>
  );
}

function CrawlDetailCompletedActions({
  crawlId,
  crawl,
  quickWins,
  quickWinsLoading,
  branding,
  onShareOpenChange,
}: Pick<
  CrawlDetailLayoutProps,
  | "crawlId"
  | "crawl"
  | "quickWins"
  | "quickWinsLoading"
  | "branding"
  | "onShareOpenChange"
>) {
  return (
    <div className="flex items-center gap-3">
      <PdfDownloadButton
        crawl={crawl}
        quickWins={quickWins ?? []}
        branding={branding}
        disabled={quickWinsLoading}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onShareOpenChange(true)}
      >
        <Share2 className="mr-1.5 h-3.5 w-3.5" />
        Share Report
      </Button>
      <ShareModal
        open={false}
        onOpenChange={onShareOpenChange}
        crawlId={crawlId}
      />
    </div>
  );
}

function CrawlDetailStatusCards({
  crawl,
}: Pick<CrawlDetailLayoutProps, "crawl">) {
  const crawlerUnavailable = isCrawlerUnavailable(crawl);

  return (
    <>
      {crawlerUnavailable && (
        <Card className="border-warning/50">
          <CardContent className="p-6">
            <p className="text-sm text-warning">
              Crawler service is being set up. Your crawl will be processed once
              the service is online. Please try again in a few minutes.
            </p>
          </CardContent>
        </Card>
      )}

      {crawl.status === "failed" &&
        !crawlerUnavailable &&
        crawl.errorMessage && (
          <Card className="border-destructive/50">
            <CardContent className="p-6">
              <p className="text-sm text-destructive">{crawl.errorMessage}</p>
            </CardContent>
          </Card>
        )}
    </>
  );
}

function CrawlDetailExecutiveSummary({
  crawl,
}: Pick<CrawlDetailLayoutProps, "crawl">) {
  if (crawl.status !== "complete" || !crawl.summary) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground">
          {crawl.summary}
        </p>
      </CardContent>
    </Card>
  );
}

function CrawlDetailProgressSection({
  crawl,
}: Pick<CrawlDetailLayoutProps, "crawl">) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CrawlProgress
        status={crawl.status as CrawlStatus}
        pagesFound={crawl.pagesFound}
        pagesCrawled={crawl.pagesCrawled}
        pagesScored={crawl.pagesScored}
        startedAt={crawl.startedAt}
      />
      <CrawlProgressChart
        found={crawl.pagesFound}
        crawled={crawl.pagesCrawled}
        scored={crawl.pagesScored}
        errored={crawl.pagesErrored ?? 0}
        status={crawl.status}
      />
    </div>
  );
}

function CrawlDetailScoreSummary({
  crawl,
  onShareOpenChange,
}: Pick<CrawlDetailLayoutProps, "crawl" | "onShareOpenChange">) {
  const crawlScores = crawl.scores;

  if (crawl.status !== "complete" || !crawlScores) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Score Summary</CardTitle>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onShareOpenChange(true)}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
            <Link
              href={`/dashboard/projects/${crawl.projectId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View Project
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <ScoreCircle
            score={crawl.overallScore ?? 0}
            size={120}
            label="Overall"
          />
          <div className="grid grid-cols-2 gap-6">
            {CRAWL_DETAIL_SCORE_ITEMS.map(({ key, label }) => {
              const score = crawlScores[key];

              return (
                <div key={label} className="text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      score != null
                        ? scoreColor(score)
                        : "text-muted-foreground",
                    )}
                  >
                    {score ?? "N/A"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CrawlDetailNextSteps({
  crawl,
  quickWins,
  onShareOpenChange,
}: Pick<CrawlDetailLayoutProps, "crawl" | "quickWins" | "onShareOpenChange">) {
  if (crawl.status !== "complete") {
    return null;
  }

  const safeQuickWins = quickWins ?? [];
  const opportunityPoints = getQuickWinOpportunityPoints(safeQuickWins);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What to Do Next</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {safeQuickWins.length > 0 && (
          <Link
            href={`/dashboard/projects/${crawl.projectId}?tab=issues`}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Fix {safeQuickWins.length} quick win
              {safeQuickWins.length !== 1 ? "s" : ""} to gain up to +
              {opportunityPoints} points
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
        {crawl.overallScore !== null && crawl.overallScore < 70 && (
          <Link
            href={`/dashboard/projects/${crawl.projectId}?tab=issues`}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Review critical issues dragging your score down
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
        <Link
          href={`/dashboard/projects/${crawl.projectId}`}
          className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            View full project overview
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <button
          type="button"
          onClick={() => onShareOpenChange(true)}
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            Share this report with your team
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}

export function CrawlDetailLayout({
  crawlId,
  crawl,
  quickWins,
  quickWinsLoading,
  issues,
  branding,
  shareOpen,
  onShareOpenChange,
}: CrawlDetailLayoutProps) {
  return (
    <div className="space-y-6">
      <CrawlDetailHeader crawl={crawl} />

      {crawl.status === "complete" && (
        <CrawlDetailCompletedActions
          crawlId={crawlId}
          crawl={crawl}
          quickWins={quickWins}
          quickWinsLoading={quickWinsLoading}
          branding={branding}
          onShareOpenChange={onShareOpenChange}
        />
      )}

      <ShareModal
        open={shareOpen}
        onOpenChange={onShareOpenChange}
        crawlId={crawlId}
      />

      <CrawlDetailStatusCards crawl={crawl} />
      <CrawlDetailExecutiveSummary crawl={crawl} />
      <CrawlDetailProgressSection crawl={crawl} />
      <CrawlDetailScoreSummary
        crawl={crawl}
        onShareOpenChange={onShareOpenChange}
      />

      {crawl.status === "complete" && issues && issues.length > 0 && (
        <IssuesTab
          issues={issues}
          crawlId={crawlId}
          projectId={crawl.projectId}
        />
      )}

      <CrawlDetailNextSteps
        crawl={crawl}
        quickWins={quickWins}
        onShareOpenChange={onShareOpenChange}
      />
    </div>
  );
}
