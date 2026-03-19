import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.queryByText(/Lead Capture Tip/i)).not.toBeInTheDocument();
  });

  it("shows only 10 rows by default when indexedPages has more than 10 entries", () => {
    const pages = Array.from({ length: 15 }, (_, i) => ({
      url: `https://example.com/page-${i + 1}`,
      status: "Submitted and indexed",
    }));

    render(
      <GscIndexStatusSection
        gsc={{
          topQueries: [],
          totalClicks: 0,
          totalImpressions: 0,
          indexedPages: pages,
        }}
      />,
    );

    const rows = screen.getAllByRole("row");
    // 1 header row + 10 data rows = 11
    expect(rows).toHaveLength(11);
  });

  it("shows 'Show all' button when indexedPages has more than 10 entries", () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/page-${i + 1}`,
      status: "Submitted and indexed",
    }));

    render(
      <GscIndexStatusSection
        gsc={{
          topQueries: [],
          totalClicks: 0,
          totalImpressions: 0,
          indexedPages: pages,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /show all 12 pages/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Show less' after clicking 'Show all'", async () => {
    const user = userEvent.setup();
    const pages = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/page-${i + 1}`,
      status: "Submitted and indexed",
    }));

    render(
      <GscIndexStatusSection
        gsc={{
          topQueries: [],
          totalClicks: 0,
          totalImpressions: 0,
          indexedPages: pages,
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /show all 12 pages/i }),
    );
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    // 1 header + 12 data rows
    expect(rows).toHaveLength(13);
  });

  it("renders filter pills with correct counts when multiple categories present", () => {
    const pages = [
      { url: "https://example.com/a", status: "Submitted and indexed" },
      {
        url: "https://example.com/b",
        status: "Crawled - currently not indexed",
      },
      {
        url: "https://example.com/c",
        status: "Discovered - currently not indexed",
      },
      { url: "https://example.com/d", status: "URL is unknown to Google" },
    ];

    render(
      <GscIndexStatusSection
        gsc={{
          topQueries: [],
          totalClicks: 0,
          totalImpressions: 0,
          indexedPages: pages,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /all.*4/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /not indexed.*2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /unknown to google.*1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /indexed.*1/i }),
    ).toBeInTheDocument();
  });

  it("filters rows when a filter pill is clicked", async () => {
    const user = userEvent.setup();
    const pages = [
      { url: "https://example.com/indexed", status: "Submitted and indexed" },
      {
        url: "https://example.com/not",
        status: "Crawled - currently not indexed",
      },
      {
        url: "https://example.com/unknown",
        status: "URL is unknown to Google",
      },
    ];

    render(
      <GscIndexStatusSection
        gsc={{
          topQueries: [],
          totalClicks: 0,
          totalImpressions: 0,
          indexedPages: pages,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /not indexed/i }));

    const rows = screen.getAllByRole("row");
    // 1 header + 1 matching row
    expect(rows).toHaveLength(2);
    expect(screen.getByText("/not")).toBeInTheDocument();
    expect(screen.queryByText("/indexed")).not.toBeInTheDocument();
  });
});
