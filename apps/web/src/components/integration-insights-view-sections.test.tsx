import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ClaritySection,
  ConnectToUnlockCard,
  GscIndexStatusSection,
  IntegrationInsightsSummaryBanner,
} from "./integration-insights-view-sections";

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

describe("integration insights view sections", () => {
  it("renders summary banners and unlock card states", () => {
    render(
      <>
        <IntegrationInsightsSummaryBanner
          summaryItems={[
            {
              icon: (() => <span>i</span>) as never,
              label: "GSC",
              value: "12 queries tracked · avg position 4.0",
            },
          ]}
        />
        <ConnectToUnlockCard
          provider="Google Search Console"
          description="See your top queries"
        />
        <ConnectToUnlockCard
          provider="Meta"
          description="See social engagement"
          isConnected
        />
      </>,
    );

    expect(
      screen.getByText("12 queries tracked · avg position 4.0"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connect Google Search Console to unlock"),
    ).toBeInTheDocument();
    expect(screen.getByText("Meta — No data yet")).toBeInTheDocument();
  });

  it("renders gsc index status and clarity fallback states", () => {
    render(
      <>
        <GscIndexStatusSection
          gsc={{
            topQueries: [],
            totalClicks: 0,
            totalImpressions: 0,
            indexedPages: [
              {
                url: "https://example.com/pricing",
                status: "Submitted and indexed",
              },
            ],
          }}
        />
        <ClaritySection
          clarity={{
            avgUxScore: 81.4,
            rageClickPages: [],
          }}
        />
      </>,
    );

    expect(screen.getByText("/pricing")).toBeInTheDocument();
    expect(screen.getByText("Submitted and indexed")).toBeInTheDocument();
    expect(screen.getByText(/No rage clicks detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Lead Capture Tip/i)).toBeInTheDocument();
  });
});
