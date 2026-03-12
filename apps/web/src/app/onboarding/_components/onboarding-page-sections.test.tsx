import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Action, WizardState } from "@/hooks/use-onboarding-wizard";
import {
  OnboardingLoadingState,
  OnboardingWizardCard,
} from "./onboarding-page-sections";

vi.mock("@/components/onboarding/stepper", () => ({
  Stepper: ({ currentStep }: { currentStep: number }) => (
    <div>Stepper {currentStep}</div>
  ),
}));

vi.mock("@/components/score-circle", () => ({
  ScoreCircle: ({ label, score }: { label: string; score: number }) => (
    <div>
      {label}: {score}
    </div>
  ),
}));

const baseState: WizardState = {
  guardChecked: true,
  step: 0,
  name: "Jane Doe",
  nameError: null,
  workStyle: null,
  teamSize: null,
  domain: "example.com",
  projectName: "Example",
  siteDescription: "",
  industry: "",
  defaultCrawlSchedule: "weekly",
  defaultAutoRunOnCrawl: true,
  defaultVisibilityScheduleEnabled: true,
  defaultWeeklyDigestEnabled: true,
  submitting: false,
  stepError: null,
  projectId: "proj-1",
  crawlId: "crawl-1",
  crawl: null,
  crawlError: null,
  startingCrawl: false,
  discoveryStatus: "idle",
  discoveryResult: null,
  discoveryError: null,
  tipIndex: 0,
};

function renderCard(state: WizardState) {
  const dispatch = vi.fn<(action: Action) => void>();
  const onContinue = vi.fn();
  const onDomainChange = vi.fn();
  const onStartScan = vi.fn();
  const onRetry = vi.fn();
  const onViewReport = vi.fn();
  const onOpenStrategy = vi.fn();
  const onOpenIntegrations = vi.fn();

  render(
    <OnboardingWizardCard
      state={state}
      dispatch={dispatch}
      onContinue={onContinue}
      onDomainChange={onDomainChange}
      onStartScan={onStartScan}
      onRetry={onRetry}
      onViewReport={onViewReport}
      onOpenStrategy={onOpenStrategy}
      onOpenIntegrations={onOpenIntegrations}
    />,
  );

  return {
    dispatch,
    onContinue,
    onDomainChange,
    onStartScan,
    onRetry,
    onViewReport,
    onOpenStrategy,
    onOpenIntegrations,
  };
}

describe("onboarding page sections", () => {
  it("renders the extracted loading state", () => {
    render(<OnboardingLoadingState />);

    expect(screen.getByLabelText("Loading onboarding")).toBeInTheDocument();
  });

  it("renders step zero and forwards profile interactions", () => {
    const { dispatch, onContinue } = renderCard(baseState);

    expect(screen.getByText("Welcome to LLM Rank")).toBeInTheDocument();
    expect(
      screen.getByText("Optional — helps us customize your dashboard"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your Name"), {
      target: { value: "Taylor" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Manage client sites/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_NAME", name: "Taylor" });
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_WORK_STYLE",
      workStyle: "client_reporting",
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders step one controls and forwards website actions", () => {
    const { dispatch, onDomainChange, onStartScan } = renderCard({
      ...baseState,
      step: 1,
      workStyle: "client_reporting",
      teamSize: "small_team",
      stepError: "Domain is required",
    });

    expect(screen.getByText("What site should we audit?")).toBeInTheDocument();
    expect(screen.getByText("Confirm default setup")).toBeInTheDocument();
    expect(screen.getByText("Domain is required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We use this context to improve the first-pass personas, keyword suggestions, and competitor discovery for your domain.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Domain"), {
      target: { value: "docs.example.com" },
    });
    fireEvent.change(screen.getByLabelText(/What does your site do/i), {
      target: { value: "Help desks for schools" },
    });
    fireEvent.change(screen.getByLabelText(/^Industry/i), {
      target: { value: "EdTech" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.click(screen.getByRole("button", { name: /Start Scan/i }));

    expect(onDomainChange).toHaveBeenCalledWith("docs.example.com");
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_SITE_DESCRIPTION",
      siteDescription: "Help desks for schools",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_INDUSTRY",
      industry: "EdTech",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_DEFAULT_CRAWL_SCHEDULE",
      schedule: "manual",
    });
    expect(onStartScan).toHaveBeenCalledTimes(1);
  });

  it("renders active crawl progress with the current tip", () => {
    renderCard({
      ...baseState,
      step: 2,
      tipIndex: 1,
      crawl: {
        id: "crawl-1",
        status: "crawling",
        pagesFound: 12,
        pagesCrawled: 5,
        pagesScored: 2,
        overallScore: null,
        letterGrade: null,
        scores: null,
        errorMessage: null,
      },
    });

    expect(screen.getByText("Scanning your site...")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pages with clear H1-H3 hierarchy rank 2x better in AI responses.",
      ),
    ).toBeInTheDocument();
  });

  it("renders completed crawl results, discovery suggestions, and follow-up actions", () => {
    const { onViewReport, onOpenStrategy, onOpenIntegrations } = renderCard({
      ...baseState,
      step: 2,
      discoveryStatus: "ready",
      discoveryResult: {
        competitors: ["hubspot.com", "semrush.com"],
        personas: [
          {
            name: "Growth Lead",
            role: "Marketing Director",
            vocabulary: ["pipeline velocity"],
            sampleQueries: ["best ai seo software for b2b"],
            funnelStage: "comparison",
            isAutoGenerated: true,
            jobToBeDone: "Find SEO tooling",
            constraints: "Needs quick wins",
            successMetrics: "More demos",
            decisionCriteria: "Proof and ROI",
          },
        ],
        keywords: [
          { keyword: "ai seo software", funnelStage: "comparison" },
          { keyword: "geo optimization tools", funnelStage: "education" },
        ],
      },
      crawl: {
        id: "crawl-1",
        status: "complete",
        pagesFound: 12,
        pagesCrawled: 12,
        pagesScored: 12,
        overallScore: 84,
        letterGrade: "B",
        scores: {
          technical: 80,
          content: 82,
          aiReadiness: 86,
          performance: 88,
        },
        errorMessage: null,
      },
    });

    expect(screen.getByText("Your AI-Readiness Score")).toBeInTheDocument();
    expect(screen.getByText("Overall: 84")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("AI Readiness")).toBeInTheDocument();
    expect(screen.getByText("Domain strategy suggestions")).toBeInTheDocument();
    expect(screen.getByText("Growth Lead")).toBeInTheDocument();
    expect(screen.getByText("hubspot.com")).toBeInTheDocument();
    expect(screen.getByText("ai seo software")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Review Strategy Workspace/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Review Google Integrations/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /View Full Report/i }));

    expect(onOpenStrategy).toHaveBeenCalledTimes(1);
    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
    expect(onViewReport).toHaveBeenCalledTimes(1);
  });
});
