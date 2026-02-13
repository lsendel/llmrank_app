"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Share2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CrawlProgress,
  isActiveCrawlStatus,
  type CrawlStatus,
} from "@/components/crawl-progress";
import { ScoreCircle } from "@/components/score-circle";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { api, ApiError, type CrawlJob } from "@/lib/api";

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function CrawlDetailPage() {
  const params = useParams<{ id: string }>();
  const { withToken } = useApi();

  const [crawl, setCrawl] = useState<CrawlJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCrawl = useCallback(async () => {
    try {
      const data = await withToken((token) => api.crawls.get(token, params.id));
      setCrawl(data);
      return data;
    } catch (err) {
      // Only set error on initial load, not during polling
      if (!crawl) {
        setError(err instanceof Error ? err.message : "Failed to load crawl");
      }
      return null;
    }
  }, [withToken, params.id, crawl]);

  // Initial fetch
  useEffect(() => {
    fetchCrawl().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 3 seconds while crawl is active
  useEffect(() => {
    if (!crawl || !isActiveCrawlStatus(crawl.status as CrawlStatus)) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      const data = await fetchCrawl();
      if (data && !isActiveCrawlStatus(data.status as CrawlStatus)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [crawl?.status, fetchCrawl]);

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
        <p className="text-muted-foreground">{error ?? "Crawl not found."}</p>
      </div>
    );
  }

  // Show friendly message when crawler service is not yet available
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

      {/* Crawl Progress */}
      <CrawlProgress
        status={crawl.status as CrawlStatus}
        pagesFound={crawl.pagesFound}
        pagesCrawled={crawl.pagesCrawled}
        pagesScored={crawl.pagesScored}
        startedAt={crawl.startedAt}
      />

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
  const { withToken } = useApi();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const result = await withToken((token) =>
        api.share.enable(token, crawlId),
      );
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
