import type { BadgeProps } from "@/components/ui/badge";
import type { CrawlJob, QuickWin } from "@/lib/api";

type CrawlScoreKey = keyof NonNullable<CrawlJob["scores"]>;

export const CRAWL_DETAIL_SCORE_ITEMS: Array<{
  key: CrawlScoreKey;
  label: string;
}> = [
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "aiReadiness", label: "AI Readiness" },
  { key: "performance", label: "Performance" },
];

export function getCrawlStatusBadgeVariant(
  status: CrawlJob["status"],
): NonNullable<BadgeProps["variant"]> {
  if (status === "complete") {
    return "success";
  }

  if (status === "failed") {
    return "destructive";
  }

  return "secondary";
}

export function getCrawlSubtitle(crawl: CrawlJob): string {
  const prefix = crawl.projectName ? `${crawl.projectName} - ` : "";

  return `${prefix}${
    crawl.startedAt
      ? `Started ${new Date(crawl.startedAt).toLocaleString()}`
      : "Pending"
  }`;
}

export function isCrawlerUnavailable(crawl: CrawlJob): boolean {
  return (
    crawl.status === "failed" &&
    crawl.errorMessage?.toLowerCase().includes("not yet available") === true
  );
}

export function getQuickWinOpportunityPoints(quickWins: QuickWin[]): number {
  return quickWins.reduce((sum, win) => sum + win.scoreImpact, 0);
}
