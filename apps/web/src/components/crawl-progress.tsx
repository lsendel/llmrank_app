"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CrawlStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "scoring"
  | "complete"
  | "failed"
  | "cancelled";

interface CrawlProgressProps {
  status: CrawlStatus;
  pagesFound: number;
  pagesCrawled: number;
  pagesScored: number;
  startedAt?: string | null;
  className?: string;
}

const statusConfig: Record<
  CrawlStatus,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "destructive"
      | "success"
      | "warning"
      | "info";
    icon: React.ElementType;
  }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  queued: { label: "Queued", variant: "secondary", icon: Clock },
  crawling: { label: "Crawling", variant: "warning", icon: Loader2 },
  scoring: { label: "Scoring", variant: "info", icon: BarChart3 },
  complete: { label: "Complete", variant: "success", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function isActiveCrawlStatus(status: CrawlStatus): boolean {
  return (
    status === "pending" ||
    status === "queued" ||
    status === "crawling" ||
    status === "scoring"
  );
}

export function CrawlProgress({
  status,
  pagesFound,
  pagesCrawled,
  pagesScored,
  startedAt,
  className,
}: CrawlProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isActive = isActiveCrawlStatus(status);

  // Elapsed time counter
  useEffect(() => {
    if (!isActive || !startedAt) return;
    const startTime = new Date(startedAt).getTime();
    const update = () =>
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const progressPercent =
    pagesFound > 0 ? Math.round((pagesCrawled / pagesFound) * 100) : 0;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Crawl Progress</CardTitle>
          <Badge variant={config.variant}>
            <StatusIcon
              className={cn("mr-1 h-3 w-3", isActive && "animate-spin")}
            />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {pagesCrawled} / {pagesFound || "?"} pages
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs">Found</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{pagesFound}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs">Crawled</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{pagesCrawled}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs">Scored</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{pagesScored}</p>
          </div>
        </div>

        {/* Elapsed time */}
        {startedAt && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
