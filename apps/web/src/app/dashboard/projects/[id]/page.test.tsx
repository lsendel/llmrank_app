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
// (Unless we want to test OverviewTab integration fully, but mocking helps isolation)
// Actually, OverviewTab uses ScoreCircle which might just render text.
// Let's verify if OverviewTab renders "Score: 88".
// Looking at OverviewTab.tsx:
// <ScoreCircle score={latestCrawl!.overallScore ?? 0} ... />
// ScoreCircle likely renders the number.
// If not mocked, ScoreCircle should render 88.

// Let's mock OverviewTab to be safe and specific about what we test in ProjectPage
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

describe("Project Page", () => {
  it("renders project name and domain", async () => {
    render(<ProjectPage />);
    // Wait for data to load if needed, but our mock is sync return { data: ... }
    // However, useEffects might cause rerenders.
    expect(await screen.findByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders overview tab by default", async () => {
    render(<ProjectPage />);
    expect(await screen.findByText("Score: 88")).toBeInTheDocument();
  });

  it("renders tabs correctly", async () => {
    render(<ProjectPage />);
    expect(await screen.findByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
  });
});
