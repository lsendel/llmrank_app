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

// Mock next/navigation for DiscoveryScreen
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the API client
vi.mock("@/lib/api", () => ({
  api: {
    account: { getMe: vi.fn().mockResolvedValue({ plan: "free" }) },
    discovery: {
      suggestCompetitors: vi.fn().mockResolvedValue({ competitors: [] }),
    },
    projects: { update: vi.fn().mockResolvedValue({}) },
    personas: { create: vi.fn().mockResolvedValue({}) },
    keywords: { createBatch: vi.fn().mockResolvedValue([]) },
    strategy: { addCompetitor: vi.fn().mockResolvedValue({}) },
  },
  ApiError: class extends Error {},
}));

// Mock PLAN_LIMITS
vi.mock("@llm-boost/shared", () => ({
  PLAN_LIMITS: {
    free: { competitorsPerProject: 1 },
    starter: { competitorsPerProject: 3 },
    pro: { competitorsPerProject: 5 },
    agency: { competitorsPerProject: 10 },
  },
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

  it("renders discovery screen at step 2 with crawl progress banner", () => {
    renderCard({
      ...baseState,
      step: 2,
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

    // Discovery screen renders with strategy setup heading
    expect(screen.getByText("Set up your domain strategy")).toBeInTheDocument();

    // Crawl progress banner shows
    expect(screen.getByText(/Crawling.*5 of ~12 pages/)).toBeInTheDocument();

    // Discovery cards are present (use getAllByText since pills + cards share labels)
    expect(screen.getAllByText("Business Goals").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText("Target Personas").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Target Keywords").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Competitors").length).toBeGreaterThanOrEqual(1);

    // Go to Dashboard CTA
    expect(
      screen.getByRole("button", { name: /Go to Dashboard/i }),
    ).toBeInTheDocument();
  });

  it("renders discovery screen with completed crawl score in banner", () => {
    renderCard({
      ...baseState,
      step: 2,
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

    // Score shown in banner
    expect(screen.getByText(/Score: 84 \/ B/)).toBeInTheDocument();

    // Goals card should be auto-opened (first active card)
    expect(
      screen.getByText(/Get mentioned in AI responses/),
    ).toBeInTheDocument();
  });
});
