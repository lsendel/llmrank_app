import { render, screen } from "@testing-library/react";
import ProjectPage from "@/app/dashboard/projects/[id]/page";
import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue("overview"),
    toString: vi.fn().mockReturnValue(""),
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

describe("Project Page", () => {
  it("renders project name and domain", async () => {
    render(<ProjectPage />);
    // Project name appears in both the page header and sidebar
    const projectNames = await screen.findAllByText("Test Project");
    expect(projectNames.length).toBeGreaterThanOrEqual(1);
    // Domain appears in page header and sidebar
    const domains = screen.getAllByText("example.com");
    expect(domains.length).toBeGreaterThanOrEqual(1);
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
  });
});
