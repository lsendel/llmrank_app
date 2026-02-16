"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Brain,
  Download,
} from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
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
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false },
);
const AIReadinessReport = dynamic(
  () =>
    import("@/components/report/report-template").then(
      (mod) => mod.AIReadinessReport,
    ),
  { ssr: false },
);

export default function CrawlDetailPage() {
  const params = useParams<{ id: string }>();
  const [pollInterval, setPollInterval] = useState(3000);

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
          <ErrorBoundary
            fallback={
              <span className="text-xs text-muted-foreground">
                PDF Preview Error
              </span>
            }
          >
            <PDFDownloadLink
              document={
                <AIReadinessReport
                  crawl={crawl}
                  quickWins={quickWins || []}
                  companyName={branding.companyName || "LLM Boost"}
                  logoUrl={branding.logoUrl}
                  primaryColor={branding.primaryColor}
                />
              }
              fileName={`llm-boost-report-${params.id}.pdf`}
            >
              {({ loading: pdfLoading }: { loading: boolean }) => (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pdfLoading || quickWinsLoading}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {pdfLoading || quickWinsLoading
                    ? "Preparing..."
                    : "Export PDF"}
                </Button>
              )}
            </PDFDownloadLink>
          </ErrorBoundary>
          <ShareButton crawlId={params.id} />
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
                <ShareButton crawlId={params.id} />
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
    </div>
  );
}

function ShareButton({ crawlId }: { crawlId: string }) {
  const { withAuth } = useApi();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const result = await withAuth(() => api.share.enable(crawlId));
      const fullUrl = `${window.location.origin}${result.shareUrl}`;
      setShareUrl(fullUrl);
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (shareUrl) {
    return (
      <div className="flex items-center gap-2">
        <code className="max-w-[200px] truncate rounded bg-muted px-2 py-1 text-xs">
          {shareUrl}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleShare}
      disabled={loading}
    >
      <Share2 className="mr-1.5 h-3.5 w-3.5" />
      {loading ? "Sharing..." : "Share Report"}
    </Button>
  );
}
