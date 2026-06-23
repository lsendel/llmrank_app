import { render, screen } from "@testing-library/react";
import ProjectPage from "@/app/dashboard/projects/[id]/page";
import { beforeEach, vi } from "vitest";

const {
  mockPush,
  mockReplace,
  searchParamState,
  firstSevenDaysState,
  mockSearchParamsGet,
  mockSearchParamsToString,
} = vi.hoisted(() => {
  const state = { tab: "overview" };
  const firstSevenDays = { issueCount: 0, actionItemTotal: 0 };
  const getMock = vi.fn((key: string) => {
    if (key === "tab") return state.tab;
    return null;
  });
  const toStringMock = vi.fn(() => `tab=${state.tab}`);
  return {
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    searchParamState: state,
    firstSevenDaysState: firstSevenDays,
    mockSearchParamsGet: getMock,
    mockSearchParamsToString: toStringMock,
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}));

// Mock hooks
vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (key: string | null) => {
    if (!key) return { data: null, isLoading: false };
    // useProject uses "project-{id}" key
    if (key.includes("project-")) {
      return {
        data: {
          id: "proj-1",
          name: "Test Project",
          domain: "example.com",
          createdAt: new Date().toISOString(),
          latestCrawl: {
            id: "crawl-1",
            status: "complete",
            overallScore: 88,
            completedAt: new Date().toISOString(),
            pagesScored: 15,
            scores: {
              overall: 88,
              content: 80,
              technical: 90,
              aiReadiness: 95,
              performance: 85,
            },
          },
        },
        isLoading: false,
      };
    }
    if (key.includes("crawls-by-project")) {
      return { data: [], isLoading: false };
    }
    if (key.includes("issues-")) {
      return {
        data: {
          data: Array.from({ length: firstSevenDaysState.issueCount }).map(
            (_, index) => ({ id: `issue-${index}` }),
          ),
        },
        isLoading: false,
      };
    }
    if (key.includes("action-items-stats-")) {
      const total = firstSevenDaysState.actionItemTotal;
      return {
        data: {
          total,
          fixed: 0,
          inProgress: total,
          dismissed: 0,
          pending: 0,
          fixRate: 0,
        },
        isLoading: false,
      };
    }
    // Mock insights/progress/etc if needed, or return null
    return { data: null, isLoading: false };
  },
}));

// Mock components used in OverviewTab to avoid complex rendering needs
vi.mock("@/components/tabs/overview-tab", () => ({
  OverviewTab: () => <div>Score: 88</div>,
}));

vi.mock("@/components/tabs/pages-tab", () => ({
  PagesTab: () => <div>Pages Tab Content</div>,
}));

vi.mock("@/components/tabs/issues-tab", () => ({
  IssuesTab: () => <div>Issues Tab Content</div>,
}));

vi.mock("@/components/tabs/strategy-tab", () => ({
  StrategyTab: () => <div>Strategy Tab Content</div>,
}));

vi.mock("@/components/cards/project-recommendations-card", () => ({
  ProjectRecommendationsCard: () => <div>Project Recommendations</div>,
}));

vi.mock("@/components/forms/branding-settings-form", () => ({
  BrandingSettingsForm: () => <div>Branding Settings</div>,
}));

vi.mock("@/components/forms/crawl-settings-form", () => ({
  CrawlSettingsForm: () => <div>Crawl Defaults Form</div>,
}));

vi.mock("@/components/settings/scoring-profile-section", () => ({
  ScoringProfileSection: () => <div>Scoring Profile Section</div>,
}));

vi.mock("@/components/settings/site-context-section", () => ({
  SiteContextSection: () => <div>Site Context Section</div>,
}));

vi.mock("@/components/settings/site-file-generator-section", () => ({
  SiteFileGeneratorSection: () => <div>Site File Generator Section</div>,
}));

describe("Project Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamState.tab = "overview";
    firstSevenDaysState.issueCount = 0;
    firstSevenDaysState.actionItemTotal = 0;
  });

  it("renders project name and domain", async () => {
    render(<ProjectPage />);

    const projectNames = await screen.findAllByText("Test Project");
    expect(projectNames.length).toBeGreaterThanOrEqual(1);
  });

  it("renders overview tab by default", async () => {
    render(<ProjectPage />);
    expect(await screen.findByText("Score: 88")).toBeInTheDocument();
  });

  it("renders sidebar navigation items", async () => {
    render(<ProjectPage />);
    // Wait for content to render
    await screen.findAllByText("Test Project");

    // Workspace and sidebar group labels
    expect(screen.getAllByText("Analyze").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Grow Visibility").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Automate & Operate").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Configure").length).toBeGreaterThanOrEqual(1);

    // Nav items appear in both sidebar and mobile nav
    const overviews = screen.getAllByText("Overview");
    expect(overviews.length).toBeGreaterThanOrEqual(1);
    const actions = screen.getAllByText("Actions");
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const pages = screen.getAllByText("Pages");
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const issues = screen.getAllByText("Issues");
    expect(issues.length).toBeGreaterThanOrEqual(1);
    const settings = screen.getAllByText("Settings");
    expect(settings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders visibility mode guidance and next-step recommendation", async () => {
    searchParamState.tab = "visibility";
    render(<ProjectPage />);

    expect(await screen.findByText("Visibility workspace")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Recommended next step: Expand coverage with AI Visibility/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Open AI Visibility").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Search Visibility").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI Visibility").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI Analysis").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/You need weekly share-of-voice/i),
    ).toBeInTheDocument();
  });

  it("renders the configure workspace when the settings tab is active", async () => {
    searchParamState.tab = "settings";
    render(<ProjectPage />);

    expect(await screen.findByText("Configure workspace")).toBeInTheDocument();
    expect(screen.getByText("Site Context")).toBeInTheDocument();
    expect(screen.getByText("Crawl Defaults")).toBeInTheDocument();
    expect(screen.getByText("Scoring Weights")).toBeInTheDocument();
    expect(screen.getByText("Site Context Section")).toBeInTheDocument();
  });
});
