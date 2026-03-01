import { render, screen } from "@testing-library/react";
import { NextStepsCard } from "@/components/cards/next-steps-card";
import type { DashboardActivity, DashboardStats } from "@/lib/api";

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalProjects: 2,
    totalCrawls: 5,
    avgScore: 82,
    creditsRemaining: 50,
    creditsTotal: 100,
    latestInsights: {
      quickWins: [],
      coverage: [],
      scoreDeltas: {
        overall: 0,
        technical: 0,
        content: 0,
        aiReadiness: 0,
        performance: 0,
      },
    },
    ...overrides,
  };
}

function makeActivity(
  overrides: Partial<DashboardActivity> = {},
): DashboardActivity {
  return {
    id: "crawl-1",
    projectId: "proj-1",
    projectName: "Project One",
    status: "complete",
    startedAt: null,
    completedAt: new Date("2026-02-27T09:00:00.000Z").toISOString(),
    pagesFound: 100,
    pagesCrawled: 100,
    pagesScored: 100,
    pagesErrored: 0,
    overallScore: 78,
    letterGrade: "B",
    scores: {
      technical: 80,
      content: 76,
      aiReadiness: 79,
      performance: 77,
    },
    errorMessage: null,
    summary: null,
    createdAt: new Date("2026-02-27T08:30:00.000Z").toISOString(),
    ...overrides,
  };
}

describe("NextStepsCard", () => {
  it("prioritizes highest-impact quick win with one-click issue workflow", () => {
    const stats = makeStats({
      latestInsights: {
        quickWins: [
          {
            code: "NO_STRUCTURED_DATA",
            message: "Add structured data to top pages",
            recommendation: "Publish JSON-LD on core templates.",
            pillar: "technical",
            owner: "engineering",
            effort: "medium",
            scoreImpact: 14,
            affectedPages: 11,
          },
        ],
        coverage: [],
        scoreDeltas: {
          overall: 0,
          technical: 0,
          content: 0,
          aiReadiness: 0,
          performance: 0,
        },
      },
    });

    render(<NextStepsCard stats={stats} activity={[makeActivity()]} />);

    expect(
      screen.getByText("Add structured data to top pages"),
    ).toBeInTheDocument();
    expect(screen.getByText("Anomaly")).toBeInTheDocument();
    expect(screen.getByText("Open fix workflow")).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /Add structured data to top pages/i,
      }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=issues");
  });

  it("routes low-score remediation step directly to issues tab", () => {
    const stats = makeStats({ avgScore: 62 });
    const activity = [
      makeActivity({ projectId: "low-score-project", overallScore: 41 }),
    ];

    render(<NextStepsCard stats={stats} activity={activity} />);

    expect(
      screen.getByRole("link", {
        name: /Fix critical issues to improve your score/i,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/projects/low-score-project?tab=issues",
    );
    expect(screen.getByText("Open issue workflow")).toBeInTheDocument();
  });

  it("renders shared empty state when no next steps are available", () => {
    const stats = makeStats({
      totalProjects: 3,
      totalCrawls: 10,
      avgScore: 88,
    });
    const activity = [
      makeActivity({
        completedAt: new Date().toISOString(),
      }),
    ];

    render(<NextStepsCard stats={stats} activity={activity} />);

    expect(screen.getByText("No priorities right now")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Run a crawl or add another project to generate prioritized actions.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open projects" })).toHaveAttribute(
      "href",
      "/dashboard/projects",
    );
  });
});
