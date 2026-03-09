import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CrawlJob } from "@/lib/api";
import {
  HistoryLockedState,
  HistoryPageHeader,
  HistoryTableCard,
  HistoryWorkflowCard,
} from "./history-page-sections";

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "3 hours ago",
}));

vi.mock("@/components/ui/workflow-guidance", () => ({
  WorkflowGuidance: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions: Array<{ label: string }>;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span>{actions.map((action) => action.label).join(",")}</span>
    </div>
  ),
}));

vi.mock("@/components/ui/state", () => ({
  StateMessage: ({
    title,
    description,
    action,
  }: {
    title: string;
    description?: string;
    action?: ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
}));

const history: CrawlJob[] = [
  {
    id: "crawl-1",
    projectId: "proj-1",
    projectName: "Marketing Site",
    status: "complete",
    startedAt: null,
    completedAt: null,
    pagesFound: 10,
    pagesCrawled: 10,
    pagesScored: 8,
    pagesErrored: 0,
    overallScore: 88,
    letterGrade: "A",
    scores: null,
    errorMessage: null,
    summary: null,
    createdAt: "2024-03-10T00:00:00.000Z",
  },
  {
    id: "crawl-2",
    projectId: "proj-2",
    projectName: null,
    status: "failed",
    startedAt: null,
    completedAt: null,
    pagesFound: 6,
    pagesCrawled: 6,
    pagesScored: 0,
    pagesErrored: 2,
    overallScore: null,
    letterGrade: null,
    scores: null,
    errorMessage: "boom",
    summary: null,
    createdAt: "2024-03-09T00:00:00.000Z",
  },
];

describe("history page sections", () => {
  it("renders header, free-plan workflow, and the locked state", () => {
    render(
      <>
        <HistoryPageHeader />
        <HistoryWorkflowCard isFree />
        <HistoryLockedState />
      </>,
    );

    expect(screen.getByText("Crawl History")).toBeInTheDocument();
    expect(screen.getByText("History workflow")).toBeInTheDocument();
    expect(screen.getAllByText("View Plans").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText("Crawl history is available on paid plans"),
    ).toBeInTheDocument();
  });

  it("renders loading and empty states for the history table card", () => {
    const { rerender } = render(
      <HistoryTableCard
        history={[]}
        isLoading
        page={1}
        pagination={null}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading crawl history")).toBeInTheDocument();

    rerender(
      <HistoryTableCard
        history={[]}
        isLoading={false}
        page={1}
        pagination={null}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
      />,
    );

    expect(screen.getByText("No crawl history yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Crawl" })).toHaveAttribute(
      "href",
      "/dashboard/projects",
    );
  });

  it("renders paid history rows, report links, and pagination controls", () => {
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();

    render(
      <HistoryTableCard
        history={history}
        isLoading={false}
        page={2}
        pagination={{ totalPages: 3 }}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />,
    );

    expect(screen.getByText("Marketing Site")).toBeInTheDocument();
    expect(screen.getByText("Unknown Project")).toBeInTheDocument();
    expect(screen.getAllByText("3 hours ago")).toHaveLength(2);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Report" })).toHaveAttribute(
      "href",
      "/dashboard/projects/proj-1?tab=reports&crawlId=crawl-1",
    );

    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });
});
