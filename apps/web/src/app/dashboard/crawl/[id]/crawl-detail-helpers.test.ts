import { describe, expect, it } from "vitest";
import type { CrawlJob, QuickWin } from "@/lib/api";
import {
  CRAWL_DETAIL_SCORE_ITEMS,
  getCrawlStatusBadgeVariant,
  getCrawlSubtitle,
  getQuickWinOpportunityPoints,
  isCrawlerUnavailable,
} from "./crawl-detail-helpers";

const baseCrawl: CrawlJob = {
  id: "crawl-1",
  projectId: "proj-1",
  projectName: "Marketing Site",
  status: "complete",
  startedAt: "2024-03-10T12:00:00.000Z",
  completedAt: null,
  pagesFound: 12,
  pagesCrawled: 10,
  pagesScored: 8,
  pagesErrored: 0,
  overallScore: 82,
  letterGrade: "B",
  scores: {
    technical: 80,
    content: 81,
    aiReadiness: 83,
    performance: 84,
  },
  errorMessage: null,
  summary: "Summary",
  createdAt: "2024-03-10T12:00:00.000Z",
};

const quickWins: QuickWin[] = [
  {
    code: "FIX_LLMS_TXT",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: 8,
    effortLevel: "low",
    message: "Add llms.txt",
    recommendation: "Publish llms.txt",
    priority: 1,
    affectedPages: 1,
  },
  {
    code: "ADD_SCHEMA",
    category: "content",
    severity: "warning",
    scoreImpact: 5,
    effortLevel: "medium",
    message: "Add schema",
    recommendation: "Implement schema markup",
    priority: 2,
    affectedPages: 4,
  },
];

describe("crawl detail helpers", () => {
  it("exposes score summary items and status badge variants", () => {
    expect(CRAWL_DETAIL_SCORE_ITEMS.map((item) => item.key)).toEqual([
      "technical",
      "content",
      "aiReadiness",
      "performance",
    ]);
    expect(getCrawlStatusBadgeVariant("complete")).toBe("success");
    expect(getCrawlStatusBadgeVariant("failed")).toBe("destructive");
    expect(getCrawlStatusBadgeVariant("crawling")).toBe("secondary");
  });

  it("formats crawl subtitles and derives unavailable/quick-win states", () => {
    expect(getCrawlSubtitle(baseCrawl)).toBe(
      `Marketing Site - Started ${new Date(baseCrawl.startedAt!).toLocaleString()}`,
    );
    expect(
      getCrawlSubtitle({
        ...baseCrawl,
        projectName: undefined,
        startedAt: null,
      }),
    ).toBe("Pending");
    expect(isCrawlerUnavailable(baseCrawl)).toBe(false);
    expect(
      isCrawlerUnavailable({
        ...baseCrawl,
        status: "failed",
        errorMessage: "Crawler not yet available in this region",
      }),
    ).toBe(true);
    expect(getQuickWinOpportunityPoints(quickWins)).toBe(13);
  });
});
