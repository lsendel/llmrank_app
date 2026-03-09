import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicScanResult } from "@/lib/api";
import {
  ScanResultsErrorState,
  ScanResultsLoadingState,
  ScanResultsReport,
} from "./scan-results-sections";

vi.mock("@/components/score-circle", () => ({
  ScoreCircle: ({ label, score }: { label: string; score: number }) => (
    <div>
      {label}: {score}
    </div>
  ),
}));

vi.mock("@/components/issue-card", () => ({
  IssueCard: ({ code, message }: { code: string; message: string }) => (
    <div>
      {code}: {message}
    </div>
  ),
}));

vi.mock("@/components/email-capture-gate", () => ({
  EmailCaptureGate: ({
    onCaptured,
  }: {
    onCaptured: (leadId: string) => void;
  }) => (
    <button type="button" onClick={() => onCaptured("lead-1")}>
      Unlock report gate
    </button>
  ),
}));

const baseResult: PublicScanResult = {
  url: "https://example.com",
  domain: "example.com",
  createdAt: "2024-03-10T00:00:00.000Z",
  scores: {
    overall: 72,
    technical: 70,
    content: 75,
    aiReadiness: 68,
    performance: 74,
    letterGrade: "B",
  },
  issues: [
    {
      code: "MISSING_TITLE",
      category: "content",
      severity: "critical",
      message: "Missing title tag",
      recommendation: "Add a title tag",
      pageId: "page-1",
      pageUrl: "https://example.com",
    },
  ] as never,
  meta: {
    title: "Example page title with enough characters",
    description: "Example description",
    wordCount: 500,
    hasLlmsTxt: false,
    hasSitemap: true,
    sitemapUrls: 3,
    aiCrawlersBlocked: ["GPTBot"],
    schemaTypes: ["Organization"],
    ogTags: { title: "Example" },
  },
  visibility: [
    { provider: "chatgpt", brandMentioned: false, urlCited: false },
    { provider: "claude", brandMentioned: false, urlCited: false },
  ],
};

describe("scan results sections", () => {
  it("renders loading and error states", () => {
    render(
      <>
        <ScanResultsLoadingState />
        <ScanResultsErrorState error="Scan failed" />
      </>,
    );

    expect(screen.getAllByText("Loading report...").length).toBeGreaterThan(0);
    expect(screen.getByText("Scan failed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Run Another Scan" }),
    ).toHaveAttribute("href", "/scan");
  });

  it("renders locked results and forwards CTA and unlock callbacks", () => {
    const onTrackCta = vi.fn();
    const onEmailCaptured = vi.fn();

    render(
      <ScanResultsReport
        result={baseResult}
        scanId="scan-1"
        isUnlocked={false}
        isSignedIn={false}
        creatingWorkspace={false}
        workspaceError={null}
        recurringScanDestination="/pricing"
        pagesSampled={12}
        sampleConfidence={{ label: "Low", variant: "destructive" }}
        visibilityChecks={[
          { provider: "chatgpt", brandMentioned: false, urlCited: false },
          { provider: "claude", brandMentioned: false, urlCited: false },
        ]}
        visibilityProviders={["chatgpt", "claude"]}
        anyVisibilityMention={false}
        onTrackCta={onTrackCta}
        onEmailCaptured={onEmailCaptured}
        onCreateWorkspace={vi.fn()}
      />,
    );

    expect(screen.getByText("AI visibility report")).toBeInTheDocument();
    expect(screen.getByText("Key Findings")).toBeInTheDocument();
    expect(screen.getByText("Top issues to fix (1)")).toBeInTheDocument();
    expect(
      screen.getByText(/Your site was not mentioned\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Schedule Recurring Scans" }),
    ).toHaveAttribute("href", "/pricing");

    fireEvent.click(screen.getByRole("link", { name: "Create free account" }));
    fireEvent.click(screen.getByRole("button", { name: "Unlock report gate" }));

    expect(onTrackCta).toHaveBeenCalledWith(
      "create_project",
      "/sign-up",
      "unlock_banner",
    );
    expect(onEmailCaptured).toHaveBeenCalledWith("lead-1");
  });

  it("renders unlocked quick wins and signed-in workspace actions", () => {
    const onCreateWorkspace = vi.fn();

    render(
      <ScanResultsReport
        result={{
          ...baseResult,
          quickWins: [
            {
              code: "FIX_LLMS_TXT",
              category: "AI Readiness",
              severity: "warning",
              scoreImpact: 8,
              effortLevel: "low",
              message: "Add llms.txt",
              recommendation: "Publish an llms.txt file.",
              implementationSnippet: "User-agent: *",
              priority: 1,
              affectedPages: 1,
            },
          ],
        }}
        scanId="scan-1"
        isUnlocked
        isSignedIn
        creatingWorkspace={false}
        workspaceError="Workspace failed"
        recurringScanDestination="/dashboard/projects"
        pagesSampled={30}
        sampleConfidence={{ label: "Medium", variant: "warning" }}
        visibilityChecks={[]}
        visibilityProviders={[]}
        anyVisibilityMention={false}
        onTrackCta={vi.fn()}
        onEmailCaptured={vi.fn()}
        onCreateWorkspace={onCreateWorkspace}
      />,
    );

    expect(screen.getByText("All Detected Issues (1)")).toBeInTheDocument();
    expect(screen.getByText("Top Quick Wins")).toBeInTheDocument();
    expect(screen.getByText("Workspace failed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Schedule Recurring Scans" }),
    ).toHaveAttribute("href", "/dashboard/projects");

    fireEvent.click(
      screen.getByRole("button", { name: "Create Project Workspace" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Add llms.txt/i }));

    expect(onCreateWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.getByText("User-agent: *")).toBeInTheDocument();
  });
});
