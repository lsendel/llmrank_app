import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DashboardAiFeaturesBanner,
  DashboardLastProjectCard,
  DashboardQuickTools,
} from "./dashboard-page-sections";
import type {
  DashboardActivity,
  DashboardStats,
} from "@/lib/api/types/dashboard";
import type { LastProjectContext } from "@/lib/workflow-memory";

const stats: DashboardStats = {
  totalProjects: 2,
  totalCrawls: 4,
  avgScore: 84,
  creditsRemaining: 100,
  creditsTotal: 250,
  latestInsights: {
    quickWins: [],
    coverage: [],
    scoreDeltas: {
      overall: 3,
      technical: 1,
      content: 1,
      aiReadiness: 1,
      performance: 0,
    },
  },
};

const activity = [
  {
    projectId: "proj-1",
    projectName: "Marketing Site",
    status: "complete",
    completedAt: "2024-03-14T10:00:00.000Z",
    createdAt: "2024-03-14T09:00:00.000Z",
  },
] as unknown as DashboardActivity[];

describe("dashboard page sections", () => {
  it("renders the last-project resume link", () => {
    const context: LastProjectContext = {
      projectId: "proj-1",
      tab: "strategy",
      projectName: "Marketing Site",
      domain: "example.com",
      visitedAt: "2024-03-14T09:00:00.000Z",
    };

    render(<DashboardLastProjectCard lastProjectContext={context} />);

    expect(
      screen.getByText(/Continue where you left off/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Resume project/i }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=strategy");
  });

  it("renders quick-tool links for the most recent project", () => {
    render(
      <DashboardQuickTools
        stats={stats}
        activity={activity}
        quickToolOrder={["strategy_personas", "ai_visibility"]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Strategy & Personas/i }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=strategy");
    expect(
      screen.getByRole("link", { name: /AI Visibility/i }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=visibility");
  });

  it("renders and dismisses the AI features banner", () => {
    const onDismiss = vi.fn();

    render(<DashboardAiFeaturesBanner show onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/What makes LLM Rank different/i),
    ).toBeInTheDocument();
  });
});
