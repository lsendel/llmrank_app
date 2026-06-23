import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CompetitorsActivitySection,
  CompetitorsBenchmarkSection,
  CompetitorsTabNavigation,
  CompetitorsTrendsSection,
} from "./competitors-tab-sections";

vi.mock("@/components/competitor-discovery-banner", () => ({
  CompetitorDiscoveryBanner: ({ projectId }: { projectId: string }) => (
    <div>Discovery {projectId}</div>
  ),
}));

vi.mock("@/components/content-gap-analysis", () => ({
  ContentGapAnalysis: ({ projectId }: { projectId: string }) => (
    <div>Gap Analysis {projectId}</div>
  ),
}));

vi.mock("@/components/upgrade-prompt", () => ({
  UpgradePrompt: () => <div>Upgrade Prompt</div>,
}));

vi.mock("@/components/competitors/activity-feed", () => ({
  ActivityFeed: ({ domains }: { domains: string[] }) => (
    <div>Activity {domains.join(",")}</div>
  ),
}));

vi.mock("@/components/competitors/trends-view", () => ({
  TrendsView: ({ competitors }: { competitors: Array<{ domain: string }> }) => (
    <div>
      Trends {competitors.map((competitor) => competitor.domain).join(",")}
    </div>
  ),
}));

describe("competitors-tab sections", () => {
  it("renders the tab navigation and notifies when switching tabs", () => {
    const onTabChange = vi.fn();
    render(
      <CompetitorsTabNavigation
        activeTab="benchmark"
        onTabChange={onTabChange}
      />,
    );

    fireEvent.click(screen.getByText("Activity Feed"));
    expect(onTabChange).toHaveBeenCalledWith("activity");
  });

  it("renders the benchmark section with competitor cards and actions", () => {
    render(
      <CompetitorsBenchmarkSection
        projectId="proj-1"
        isStarter
        isLoading={false}
        newDomain="example.com"
        benchmarking={false}
        error={null}
        hasRetryAction={false}
        rebenchmarkingId={null}
        togglingId={null}
        competitors={[
          {
            competitorDomain: "example.com",
            crawledAt: "2024-01-01T00:00:00.000Z",
            scores: {
              overall: 75,
              technical: 74,
              content: 71,
              aiReadiness: 78,
              performance: 68,
            },
            comparison: {
              overall: 5,
              technical: 4,
              content: 3,
              aiReadiness: 7,
              performance: -2,
            },
          },
        ]}
        competitorInsights={[
          {
            competitorDomain: "example.com",
            winningQueries: [
              {
                query: "ai seo software",
                providers: ["chatgpt", "perplexity"],
                wins: 3,
                bestPosition: 1,
                avgPosition: 1.7,
                lastSeenAt: "2024-01-02T00:00:00.000Z",
                yourMentioned: false,
                yourCited: false,
              },
            ],
            inferredThemes: [
              {
                label: "AI SEO",
                source: "mixed",
                evidence: ["AI SEO platform", "ai seo software"],
              },
            ],
            homepageSignals: {
              title: "AI SEO platform",
              metaDescription: "Grow visibility in AI answers",
              headings: ["AI SEO platform for teams"],
            },
          },
        ]}
        projectScores={{
          overall: 80,
          technical: 78,
          content: 74,
          aiReadiness: 85,
          performance: 66,
        }}
        strategyByDomain={
          new Map([
            [
              "example.com",
              {
                id: "comp-1",
                projectId: "proj-1",
                domain: "example.com",
                createdAt: "2024-01-01T00:00:00.000Z",
              },
            ],
          ])
        }
        onDomainChange={vi.fn()}
        onBenchmark={vi.fn()}
        onRetry={vi.fn()}
        onRebenchmark={vi.fn()}
        onToggleMonitoring={vi.fn()}
      />,
    );

    expect(screen.getByText("Discovery proj-1")).toBeInTheDocument();
    expect(screen.getByText("Upgrade Prompt")).toBeInTheDocument();
    expect(screen.getByText("Competitor Benchmarking")).toBeInTheDocument();
    expect(screen.getAllByText("example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("You lead")).toBeInTheDocument();
    expect(
      screen.getByText("Top Competitor-Winning Queries"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ai seo software").length).toBeGreaterThan(0);
    expect(screen.getByText("Inferred Messaging Themes")).toBeInTheDocument();
    expect(screen.getByText("AI SEO")).toBeInTheDocument();
    expect(screen.getByText("Gap Analysis proj-1")).toBeInTheDocument();
    expect(screen.getByText("Re-benchmark")).toBeInTheDocument();
  });

  it("renders activity and trends wrappers with forwarded competitor props", () => {
    const { rerender } = render(
      <CompetitorsActivitySection
        projectId="proj-1"
        competitorDomains={["a.com", "b.com"]}
        competitorFeedLimit={20}
      />,
    );

    expect(screen.getByText("Activity a.com,b.com")).toBeInTheDocument();

    rerender(
      <CompetitorsTrendsSection
        projectId="proj-1"
        competitors={[{ domain: "a.com", id: "comp-1" }]}
        competitorTrendDays={90}
      />,
    );

    expect(screen.getByText("Trends a.com")).toBeInTheDocument();
  });
});
