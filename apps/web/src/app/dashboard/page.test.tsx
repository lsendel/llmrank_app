import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import { vi } from "vitest";

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
      getMe: vi.fn().mockResolvedValue({ persona: null }),
    },
  },
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("Dashboard Page", () => {
  it("renders welcome message with user name", () => {
    render(<DashboardPage />);
    // "Test User" becomes "Test" due to split(" ")[0]
    expect(screen.getByText(/Welcome back, Test/i)).toBeInTheDocument();
  });

  it("renders stats widgets correctly", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Projects")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    // Adjusted to match actual component text
    expect(screen.getByText("Average Score")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("renders recent activity", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("renders Quick Tools widget", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Strategy & Personas")).toBeInTheDocument();
    expect(screen.getByText("Competitor Tracking")).toBeInTheDocument();
  });
});
