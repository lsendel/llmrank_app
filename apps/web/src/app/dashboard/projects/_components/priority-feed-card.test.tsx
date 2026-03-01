import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PriorityFeedCard } from "./priority-feed-card";
import type { PortfolioPriorityItem } from "@/lib/api";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { vi } from "vitest";

const mockUseApiSWR = vi.fn();
const mutateMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    dashboard: {
      getPriorityFeed: vi.fn(),
    },
    projects: {
      rerunAutoGeneration: vi.fn(),
    },
  },
}));

function makeItem(
  overrides: Partial<PortfolioPriorityItem> = {},
): PortfolioPriorityItem {
  return {
    id: "item-1",
    projectId: "proj-1",
    projectName: "Project 1",
    projectDomain: "example.com",
    priority: "high",
    category: "issues",
    channel: "google",
    title: "Fix critical markup issues",
    description: "Structured data is missing on key templates.",
    reason: "Blocks high-confidence ranking gains.",
    action: "/dashboard/projects/proj-1?tab=issues",
    owner: null,
    dueDate: "2026-03-05T00:00:00.000Z",
    expectedImpact: "high",
    impactScore: 92,
    trendDelta: -12,
    effort: "medium",
    freshness: {
      generatedAt: "2026-03-01T00:00:00.000Z",
      lastCrawlAt: "2026-02-28T00:00:00.000Z",
    },
    source: {
      signals: ["issue_severity", "score_trend_delta"],
      confidence: 0.93,
    },
    ...overrides,
  };
}

describe("PriorityFeedCard", () => {
  let feed: PortfolioPriorityItem[];

  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockResolvedValue(undefined);
    feed = [];
    mockUseApiSWR.mockImplementation(() => ({
      data: feed,
      isLoading: false,
      mutate: mutateMock,
    }));
  });

  it("shows top 5 actions with urgency, impact, and channel filters", () => {
    feed = [
      makeItem({ id: "i-1", title: "Action 1" }),
      makeItem({ id: "i-2", title: "Action 2" }),
      makeItem({ id: "i-3", title: "Action 3" }),
      makeItem({ id: "i-4", title: "Action 4" }),
      makeItem({ id: "i-5", title: "Action 5" }),
      makeItem({ id: "i-6", title: "Action 6" }),
    ];

    render(<PriorityFeedCard />);

    expect(screen.getByText("Urgency")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Channel")).toBeInTheDocument();

    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.getByText("Action 5")).toBeInTheDocument();
    expect(screen.queryByText("Action 6")).not.toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: "Open Page" }).length).toBe(5);
    expect(screen.getAllByRole("button", { name: "Assign" }).length).toBe(5);
    expect(screen.getAllByRole("button", { name: "Run Fix" }).length).toBe(5);
  });

  it("filters feed items by impact, urgency, and channel", () => {
    feed = [
      makeItem({
        id: "i-google-high",
        title: "Google high urgency",
        expectedImpact: "high",
        priority: "critical",
        channel: "google",
      }),
      makeItem({
        id: "i-llm-low",
        title: "LLM low urgency",
        expectedImpact: "low",
        priority: "high",
        channel: "llm",
      }),
      makeItem({
        id: "i-both-medium",
        title: "Both medium urgency",
        expectedImpact: "medium",
        priority: "medium",
        channel: "both",
      }),
    ];

    render(<PriorityFeedCard />);

    fireEvent.click(screen.getByRole("button", { name: "impact-low" }));
    expect(screen.getByText("LLM low urgency")).toBeInTheDocument();
    expect(screen.queryByText("Google high urgency")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "urgency-high" }));
    expect(screen.getByText("LLM low urgency")).toBeInTheDocument();
    expect(screen.queryByText("Both medium urgency")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "channel-llm" }));
    expect(screen.getByText("LLM low urgency")).toBeInTheDocument();
    expect(screen.queryByText("Google high urgency")).not.toBeInTheDocument();
  });

  it("tracks and executes open/assign/run-fix actions", async () => {
    feed = [makeItem({ id: "i-action", projectId: "proj-action" })];
    vi.mocked(api.projects.rerunAutoGeneration).mockResolvedValue({} as never);

    render(<PriorityFeedCard />);

    fireEvent.click(screen.getByRole("link", { name: "Open Page" }));
    expect(track).toHaveBeenCalledWith(
      "priority_action_opened",
      expect.objectContaining({
        actionType: "open_page",
        priorityItemId: "i-action",
        projectId: "proj-action",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(track).toHaveBeenCalledWith(
      "priority_action_completed",
      expect.objectContaining({
        actionType: "assign",
        priorityItemId: "i-action",
      }),
    );
    expect(screen.getByText("Owner: Me")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run Fix" }));
    await waitFor(() => {
      expect(api.projects.rerunAutoGeneration).toHaveBeenCalledWith(
        "proj-action",
      );
    });
    expect(track).toHaveBeenCalledWith(
      "priority_action_completed",
      expect.objectContaining({
        actionType: "run_fix",
        priorityItemId: "i-action",
      }),
    );
  });
});
