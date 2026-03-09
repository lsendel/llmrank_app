import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationInsightsView } from "./integration-insights-view";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => <div data-testid="chart-bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe("IntegrationInsightsView", () => {
  it("returns nothing when integration insights are unavailable", () => {
    const { container } = render(
      <IntegrationInsightsView
        insights={{ crawlId: null, integrations: null }}
        connectedProviders={[]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders provider sections and unlock cards from the integration payload", () => {
    render(
      <IntegrationInsightsView
        insights={{
          crawlId: "crawl-1",
          integrations: {
            gsc: {
              topQueries: [
                {
                  query: "llm rank",
                  impressions: 100,
                  clicks: 20,
                  position: 4.2,
                },
              ],
              totalClicks: 20,
              totalImpressions: 100,
              indexedPages: [],
            },
            ga4: {
              bounceRate: 42.5,
              avgEngagement: 93.2,
              topPages: [{ url: "https://example.com/", sessions: 120 }],
            },
            clarity: null,
            meta: null,
          },
        }}
        connectedProviders={["clarity"]}
      />,
    );

    expect(
      screen.getByText("Top Search Queries (Impressions)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Engagement Summary")).toBeInTheDocument();
    expect(
      screen.getByText("Microsoft Clarity — No data yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Connect Meta to unlock")).toBeInTheDocument();
  });
});
