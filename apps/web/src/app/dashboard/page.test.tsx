import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import { vi } from "vitest";

const { mockGetMe } = vi.hoisted(() => ({
  mockGetMe: vi.fn().mockResolvedValue({ persona: null }),
}));

// Mock hooks
vi.mock("@/lib/auth-hooks", () => ({
  useUser: () => ({
    user: { name: "Test User", email: "test@example.com" },
    loading: false,
  }),
}));

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardStats: () => ({
    data: {
      totalProjects: 5,
      totalCrawls: 12,
      avgScore: 85,
      creditsRemaining: 100,
      creditsTotal: 500,
      latestInsights: {
        scoreDeltas: {
          overall: 5,
          technical: 2,
          content: 0,
          aiReadiness: 3,
          performance: 0,
        },
        quickWins: [],
        coverage: [],
      },
    },
    isLoading: false,
  }),
  useRecentActivity: () => ({
    data: [
      {
        id: "crawl-1",
        projectId: "proj-1",
        projectName: "Test Project",
        status: "complete",
        pagesScored: 10,
        overallScore: 90,
        completedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-persona-layout", () => ({
  usePersonaLayout: () => ({
    widgetOrder: ["stats", "score_momentum", "activity"],
    isPersonalized: false,
  }),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    account: {
      getMe: mockGetMe,
    },
  },
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("Dashboard Page", () => {
  it("renders welcome message with user name", async () => {
    render(<DashboardPage />);
    // "Test User" becomes "Test" due to split(" ")[0]
    expect(await screen.findByText(/Welcome back, Test/i)).toBeInTheDocument();
    expect(
      await screen.findByText("Since your last visit"),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
  });

  it("renders stats widgets correctly", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Total Projects")).toBeInTheDocument();
    expect(await screen.findByText("5")).toBeInTheDocument();
    // Adjusted to match actual component text
    expect(await screen.findByText("Average Score")).toBeInTheDocument();
    expect(await screen.findByText("85")).toBeInTheDocument();
    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
  });

  it("renders recent activity", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Test Project")).toBeInTheDocument();
    expect(await screen.findByText("90")).toBeInTheDocument();
    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
  });

  it("renders Quick Tools widget", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Strategy & Personas")).toBeInTheDocument();
    expect(await screen.findByText("Competitor Tracking")).toBeInTheDocument();
    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
  });
});
