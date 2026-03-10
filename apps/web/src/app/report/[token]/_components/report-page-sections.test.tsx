import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SharedReport } from "@/lib/api";
import { ReportPageLayout } from "./report-page-sections";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/email-capture-gate", () => ({
  EmailCaptureGate: ({ reportToken }: { reportToken?: string }) => (
    <div>Mock email gate for {reportToken}</div>
  ),
}));

const report: SharedReport = {
  crawlId: "crawl-12345678",
  projectId: "project-1",
  completedAt: "2026-03-07T12:00:00.000Z",
  pagesScored: 12,
  pagesCrawled: 14,
  summary: "Example summary",
  summaryData: null,
  project: {
    name: "Example Project",
    domain: "example.com",
    branding: {
      companyName: "Example Agency",
      primaryColor: "#123456",
    },
  },
  scores: {
    overall: 82,
    technical: 79,
    content: 76,
    aiReadiness: 90,
    performance: 71,
    letterGrade: "B",
  },
  pages: [
    {
      url: "https://example.com",
      title: "Home",
      overallScore: 84,
      technicalScore: 82,
      contentScore: 80,
      aiReadinessScore: 88,
      issueCount: 3,
    },
  ],
  issueCount: 7,
  quickWins: [
    {
      code: "MISSING_H1",
      category: "content",
      severity: "critical",
      scoreImpact: 12,
      effortLevel: "low",
      message: "Add a clear H1",
      recommendation: "Add a descriptive H1 to top landing pages.",
      priority: 1,
      affectedPages: 4,
      owner: "SEO",
      pillar: "Content",
      docsUrl: "https://docs.example.com/h1",
    },
  ],
  readinessCoverage: [
    {
      code: "llms-txt",
      label: "LLMs.txt coverage",
      description: "Coverage description",
      pillar: "technical",
      coveragePercent: 75,
      affectedPages: 3,
      totalPages: 12,
    },
  ],
  scoreDeltas: {
    overall: 4,
    technical: 1,
    content: -2,
    aiReadiness: 3,
    performance: 0,
  },
};

describe("report page sections", () => {
  it("renders the extracted unlocked agency report layout", () => {
    render(
      <ReportPageLayout
        report={report}
        reportToken="token-123"
        emailCaptured={true}
        onEmailCaptured={vi.fn()}
      />,
    );

    expect(screen.getByText("Strategic Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Executive Action Brief")).toBeInTheDocument();
    expect(
      screen.getByText("Top Recommended Improvements"),
    ).toBeInTheDocument();
    expect(screen.getByText("Affected Pages & Scores")).toBeInTheDocument();
    expect(screen.getByText(/Prepared by Example Agency/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contact Us/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Playbook ↗")).toBeInTheDocument();
  });

  it("renders the email gate and product CTA for locked non-agency reports", () => {
    render(
      <ReportPageLayout
        report={{
          ...report,
          project: {
            ...report.project,
            branding: undefined,
          },
        }}
        reportToken="token-456"
        emailCaptured={false}
        onEmailCaptured={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Mock email gate for token-456"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Top Recommended Improvements"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Free Scan" })).toHaveAttribute(
      "href",
      "/scan",
    );
    expect(
      screen.getByRole("link", { name: "Start Free Trial" }),
    ).toHaveAttribute("href", "/sign-up");
  });
});
