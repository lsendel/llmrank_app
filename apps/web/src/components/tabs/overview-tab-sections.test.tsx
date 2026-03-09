import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  OverviewFreshnessSummary,
  OverviewStatusStateCard,
  OverviewTopIssuesSection,
} from "./overview-tab-sections";

vi.mock("@/components/issue-card", () => ({
  IssueCard: (props: { message: string }) => <div>{props.message}</div>,
}));

vi.mock("@/lib/insight-metadata", () => ({
  relativeTimeLabel: (value: string | null) => value ?? "never",
}));

describe("overview-tab sections", () => {
  it("renders the loading and error state cards", () => {
    const { rerender } = render(
      <OverviewStatusStateCard
        state={{ kind: "loading", crawlId: "crawl-1" }}
      />,
    );

    expect(screen.getByText("Crawl in progress")).toBeInTheDocument();
    expect(screen.getByText("crawl page")).toBeInTheDocument();

    rerender(
      <OverviewStatusStateCard
        state={{ kind: "error", errorMessage: "Crawler timed out" }}
      />,
    );

    expect(screen.getByText("Last crawl failed")).toBeInTheDocument();
    expect(screen.getByText(/Crawler timed out/)).toBeInTheDocument();
  });

  it("renders freshness badges from derived crawl metadata", () => {
    render(
      <OverviewFreshnessSummary
        crawlTimestamp="2024-01-02T00:00:00.000Z"
        pagesSampled={12}
        dataConfidence={{ label: "High", variant: "success" }}
        crawlId="crawl-12345678"
      />,
    );

    expect(screen.getByText(/Last analyzed:/)).toBeInTheDocument();
    expect(screen.getByText(/Pages sampled: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: High/)).toBeInTheDocument();
    expect(screen.getByText(/Crawl: crawl-12/)).toBeInTheDocument();
  });

  it("renders the top issues preview and destination link", () => {
    render(
      <OverviewTopIssuesSection
        projectId="proj-1"
        issues={
          [{ code: "MISSING_TITLE", message: "Missing title" }] as never[]
        }
      />,
    );

    expect(screen.getByText("Top Issues")).toBeInTheDocument();
    expect(screen.getByText("Missing title")).toBeInTheDocument();
    expect(screen.getByText("View all issues")).toHaveAttribute(
      "href",
      "/dashboard/projects/proj-1?tab=issues",
    );
  });
});
