import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CrawlJob, PageIssue, QuickWin } from "@/lib/api";
import { CrawlDetailLayout } from "./crawl-detail-page-sections";

vi.mock("@/components/crawl-progress", () => ({
  CrawlProgress: ({ status }: { status: string }) => (
    <div>Crawl progress: {status}</div>
  ),
}));

vi.mock("@/components/charts/crawl-progress-chart", () => ({
  CrawlProgressChart: ({ found }: { found: number }) => (
    <div>Progress chart: {found}</div>
  ),
}));

vi.mock("@/components/score-circle", () => ({
  ScoreCircle: ({ label, score }: { label: string; score: number }) => (
    <div>
      {label}: {score}
    </div>
  ),
}));

vi.mock("@/components/report/pdf-download-button", () => ({
  PdfDownloadButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      Export PDF
    </button>
  ),
}));

vi.mock("@/components/share/share-modal", () => ({
  ShareModal: ({ open, crawlId }: { open: boolean; crawlId: string }) =>
    open ? <div>Share modal for {crawlId}</div> : null,
}));

vi.mock("@/components/tabs/issues-tab", () => ({
  IssuesTab: ({ issues }: { issues: PageIssue[] }) => (
    <div>Issues tab: {issues.length}</div>
  ),
}));

const completeCrawl: CrawlJob = {
  id: "crawl-1",
  projectId: "proj-1",
  projectName: "Marketing Site",
  status: "complete",
  startedAt: "2024-03-10T12:00:00.000Z",
  completedAt: null,
  pagesFound: 12,
  pagesCrawled: 10,
  pagesScored: 8,
  pagesErrored: 1,
  overallScore: 84,
  letterGrade: "B",
  scores: {
    technical: 81,
    content: 82,
    aiReadiness: 83,
    performance: null,
  },
  errorMessage: null,
  summary: "Strong foundation with a few quick wins.",
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

const issues: PageIssue[] = [
  {
    code: "MISSING_TITLE",
    category: "content",
    severity: "critical",
    message: "Missing title tag",
    recommendation: "Add title tags",
    pageId: "page-1",
    pageUrl: "https://example.com",
  },
];

describe("crawl detail page sections", () => {
  it("renders the extracted complete crawl layout and forwards share actions", () => {
    const onShareOpenChange = vi.fn();

    render(
      <CrawlDetailLayout
        crawlId="crawl-1"
        crawl={completeCrawl}
        quickWins={quickWins}
        quickWinsLoading={false}
        issues={issues}
        branding={{ companyName: "LLM Rank" }}
        shareOpen={false}
        onShareOpenChange={onShareOpenChange}
      />,
    );

    expect(screen.getByText("Crawl Details")).toBeInTheDocument();
    expect(screen.getByText(/Marketing Site - Started/i)).toBeInTheDocument();
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Score Summary")).toBeInTheDocument();
    expect(screen.getByText("What to Do Next")).toBeInTheDocument();
    expect(screen.getByText("Overall: 84")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("Issues tab: 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Fix 2 quick wins/i }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=issues");

    fireEvent.click(screen.getByRole("button", { name: /Share Report/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Share this report with your team/i }),
    );

    expect(onShareOpenChange).toHaveBeenCalledWith(true);
    expect(onShareOpenChange).toHaveBeenCalledTimes(2);
  });

  it("renders the share modal and disables PDF export while quick wins load", () => {
    render(
      <CrawlDetailLayout
        crawlId="crawl-1"
        crawl={completeCrawl}
        quickWins={quickWins}
        quickWinsLoading
        issues={[]}
        branding={{}}
        shareOpen
        onShareOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Share modal for crawl-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
  });

  it("renders crawler unavailable and failed error states", () => {
    const { rerender } = render(
      <CrawlDetailLayout
        crawlId="crawl-1"
        crawl={{
          ...completeCrawl,
          status: "failed",
          scores: null,
          summary: null,
          errorMessage: "Crawler not yet available in this region",
        }}
        quickWins={[]}
        quickWinsLoading={false}
        issues={[]}
        branding={{}}
        shareOpen={false}
        onShareOpenChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Crawler service is being set up/i),
    ).toBeInTheDocument();

    rerender(
      <CrawlDetailLayout
        crawlId="crawl-1"
        crawl={{
          ...completeCrawl,
          status: "failed",
          scores: null,
          summary: null,
          errorMessage: "Crawl failed hard",
        }}
        quickWins={[]}
        quickWinsLoading={false}
        issues={[]}
        branding={{}}
        shareOpen={false}
        onShareOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Crawl failed hard")).toBeInTheDocument();
    expect(screen.queryByText("Executive Summary")).not.toBeInTheDocument();
  });
});
