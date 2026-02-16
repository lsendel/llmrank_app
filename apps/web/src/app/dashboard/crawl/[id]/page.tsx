"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Brain,
  Zap,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CrawlProgress,
  isActiveCrawlStatus,
  type CrawlStatus,
} from "@/components/crawl-progress";
import { ScoreCircle } from "@/components/score-circle";
import { CrawlProgressChart } from "@/components/charts/crawl-progress-chart";
import { cn, scoreColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { PdfDownloadButton } from "@/components/report/pdf-download-button";
import { ShareModal } from "@/components/share/share-modal";

export default function CrawlDetailPage() {
  const params = useParams<{ id: string }>();
  const [pollInterval, setPollInterval] = useState(3000);
  const [shareOpen, setShareOpen] = useState(false);

  const {
    data: crawl,
    error,
    isLoading: loading,
  } = useApiSWR(
    `crawl-${params.id}`,
    useCallback(() => api.crawls.get(params.id), [params.id]),
    {
      refreshInterval: pollInterval,
      onSuccess: (data) => {
        if (!isActiveCrawlStatus(data.status as CrawlStatus)) {
          setPollInterval(0); // stop polling
        } else {
          // Exponential backoff: 3s → 4.5s → 6.75s → ... → 30s cap
          setPollInterval((prev) =>
            prev === 0 ? 0 : Math.min(Math.round(prev * 1.5), 30_000),
          );
        }
      },
    },
  );

  const projectId = crawl?.projectId;
  const { data: project } = useApiSWR(
    projectId ? `project-${projectId}` : null,
    useCallback(async () => {
      if (!projectId) throw new Error("No project ID");
      return api.projects.get(projectId);
    }, [projectId]),
  );

  const { data: quickWins, isLoading: quickWinsLoading } = useApiSWR(
    `quick-wins-${params.id}`,
    useCallback(() => api.quickWins.get(params.id), [params.id]),
  );

  const branding = (project?.branding ?? {}) as {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading crawl details...</p>
      </div>
    );
  }

  if (error || !crawl) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Crawl not found."}
        </p>
      </div>
    );
  }

  const isCrawlerUnavailable =
    crawl.status === "failed" &&
    crawl.errorMessage?.toLowerCase().includes("not yet available");

  return (
    <div className="space-y-6">
      {/* Header */}
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
              {crawl.projectName && `${crawl.projectName} - `}
              {crawl.startedAt
                ? `Started ${new Date(crawl.startedAt).toLocaleString()}`
                : "Pending"}
            </p>
          </div>
          <Badge
            variant={
              crawl.status === "complete"
                ? "success"
                : crawl.status === "failed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {crawl.status}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      {crawl.status === "complete" && (
        <div className="flex items-center gap-3">
          <PdfDownloadButton
            crawl={crawl}
            quickWins={quickWins || []}
            branding={branding}
            crawlId={params.id}
            disabled={quickWinsLoading}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share Report
          </Button>
          <ShareModal
            open={shareOpen}
            onOpenChange={setShareOpen}
            crawlId={params.id}
          />
        </div>
      )}

      {/* Crawler unavailable message */}
      {isCrawlerUnavailable && (
        <Card className="border-warning/50">
          <CardContent className="p-6">
            <p className="text-sm text-warning">
              Crawler service is being set up. Your crawl will be processed once
              the service is online. Please try again in a few minutes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed with error message */}
      {crawl.status === "failed" &&
        !isCrawlerUnavailable &&
        crawl.errorMessage && (
          <Card className="border-destructive/50">
            <CardContent className="p-6">
              <p className="text-sm text-destructive">{crawl.errorMessage}</p>
            </CardContent>
          </Card>
        )}

      {/* AI Summary */}
      {crawl.status === "complete" && crawl.summary && (
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
      )}

      {/* Crawl Progress */}
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

      {/* Score summary (when complete) */}
      {crawl.status === "complete" && crawl.scores && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Score Summary</CardTitle>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShareOpen(true)}
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
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Technical</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      scoreColor(crawl.scores.technical),
                    )}
                  >
                    {crawl.scores.technical}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Content</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      scoreColor(crawl.scores.content),
                    )}
                  >
                    {crawl.scores.content}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">AI Readiness</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      scoreColor(crawl.scores.aiReadiness),
                    )}
                  >
                    {crawl.scores.aiReadiness}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Performance</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      scoreColor(crawl.scores.performance),
                    )}
                  >
                    {crawl.scores.performance}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What's Next actions */}
      {crawl.status === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to Do Next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickWins && quickWins.length > 0 && (
              <Link
                href={`/dashboard/projects/${crawl.projectId}?tab=issues`}
                className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Fix {quickWins.length} quick win
                  {quickWins.length !== 1 ? "s" : ""} to gain up to +
                  {quickWins.reduce((sum, w) => sum + w.scoreImpact, 0)} points
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
              onClick={() => setShareOpen(true)}
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
      )}
    </div>
  );
}
