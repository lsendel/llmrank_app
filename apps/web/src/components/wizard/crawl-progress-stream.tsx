"use client";

import { useCrawlPolling } from "@/hooks/use-crawl";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";

interface CrawlProgressStreamProps {
  crawlId: string;
  onComplete: () => void;
}

interface Phase {
  label: string;
  status: "pending" | "active" | "complete";
  progress: number;
  detail: string;
}

export function CrawlProgressStream({
  crawlId,
  onComplete,
}: CrawlProgressStreamProps) {
  const { crawl } = useCrawlPolling(crawlId);

  const pagesFound = crawl?.pagesFound ?? 0;
  const pagesCrawled = crawl?.pagesCrawled ?? 0;
  const pagesScored = crawl?.pagesScored ?? 0;
  const status = crawl?.status ?? "pending";

  // Determine phase states
  const crawlDone = pagesCrawled > 0 && pagesCrawled >= pagesFound;
  const scoreDone = crawlDone && pagesScored >= pagesCrawled;
  const isComplete = status === "complete";

  if (isComplete && onComplete) {
    // Defer to avoid calling during render
    setTimeout(onComplete, 500);
  }

  const phases: Phase[] = [
    {
      label: "Crawling pages",
      status: crawlDone ? "complete" : pagesFound > 0 ? "active" : "pending",
      progress: pagesFound > 0 ? (pagesCrawled / pagesFound) * 100 : 0,
      detail:
        pagesFound > 0
          ? `${pagesCrawled}/${pagesFound} pages`
          : "Discovering pages...",
    },
    {
      label: "Scoring content",
      status: scoreDone ? "complete" : crawlDone ? "active" : "pending",
      progress:
        crawlDone && pagesCrawled > 0 ? (pagesScored / pagesCrawled) * 100 : 0,
      detail: crawlDone
        ? `${pagesScored}/${pagesCrawled} scored`
        : "Waiting for crawl...",
    },
    {
      label: "AI analysis",
      status: isComplete ? "complete" : scoreDone ? "active" : "pending",
      progress: isComplete ? 100 : 0,
      detail: isComplete
        ? "Report ready"
        : scoreDone
          ? "Generating insights..."
          : "Waiting for scores...",
    },
  ];

  const completedPhases = phases.filter((p) => p.status === "complete").length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Analyzing your website</h2>
        <p className="text-sm text-muted-foreground">
          {completedPhases}/3 phases complete
        </p>
      </div>

      <div className="space-y-4">
        {phases.map((phase) => (
          <div
            key={phase.label}
            className="rounded-lg border p-4 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {phase.status === "complete" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : phase.status === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span
                  className={`text-sm font-medium ${
                    phase.status === "pending"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {phase.detail}
              </span>
            </div>
            {phase.status !== "pending" && (
              <Progress value={phase.progress} className="h-1.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
