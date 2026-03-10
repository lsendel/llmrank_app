import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicReport } from "@/lib/api";
import { SharePageLayout, SharePageNotFoundView } from "./share-page-sections";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../page-table", () => ({
  SortablePageTable: ({ pages }: { pages: Array<{ url: string }> }) => (
    <div>Mock page table: {pages.length}</div>
  ),
}));

const report: PublicReport = {
  shareLevel: "full",
  crawlId: "crawl-1",
  projectId: "project-1",
  completedAt: "2026-03-07T00:00:00.000Z",
  pagesScored: 4,
  pagesCrawled: 6,
  summary: "Example summary",
  summaryData: null,
  project: { name: "Example", domain: "example.com", branding: null },
  scores: {
    overall: 82.6,
    technical: 80,
    content: 78,
    aiReadiness: 88,
    performance: 73,
    letterGrade: "B",
  },
  pages: [
    {
      url: "https://example.com",
      title: "Home",
      overallScore: 84,
      technicalScore: 82,
      contentScore: 80,
      aiReadinessScore: 86,
      issueCount: 3,
    },
  ],
  issueCount: 7,
  readinessCoverage: {},
  scoreDeltas: {
    overall: 4,
    technical: 0,
    content: -2,
    aiReadiness: 3,
    performance: 1,
  },
  quickWins: [
    {
      code: "MISSING_H1",
      category: "content",
      severity: "critical",
      scoreImpact: 12,
      effortLevel: "low",
      message: "Add a clear H1",
      recommendation: "Add a descriptive H1 to top landing pages.",
      affectedPages: 4,
    },
  ],
};

describe("share page sections", () => {
  it("renders the extracted not-found view", () => {
    render(<SharePageNotFoundView />);

    expect(screen.getByText("Report not found or expired")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get Your Free AI Readiness Scan" }),
    ).toHaveAttribute("href", "/");
  });

  it("renders the extracted public report layout", () => {
    render(<SharePageLayout report={report} />);

    expect(screen.getByText("AI Readiness Report")).toBeInTheDocument();
    expect(screen.getByText("Executive Action Brief")).toBeInTheDocument();
    expect(screen.getByText("Top Quick Wins")).toBeInTheDocument();
    expect(
      screen.getByText("Score Changes vs. Previous Crawl"),
    ).toBeInTheDocument();
    expect(screen.getByText("Page-by-Page Scores")).toBeInTheDocument();
    expect(screen.getByText("Mock page table: 1")).toBeInTheDocument();
    expect(screen.getByText(/Evidence: 6 pages/i)).toBeInTheDocument();
    expect(screen.getByText(/Updated:/i)).toBeInTheDocument();
  });

  it("hides issue-only sections for summary shares", () => {
    render(
      <SharePageLayout
        report={{
          ...report,
          shareLevel: "summary",
          quickWins: [],
          scoreDeltas: null,
          pages: [],
        }}
      />,
    );

    expect(
      screen.queryByText("Executive Action Brief"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Top Quick Wins")).not.toBeInTheDocument();
    expect(screen.queryByText("Page-by-Page Scores")).not.toBeInTheDocument();
  });
});
