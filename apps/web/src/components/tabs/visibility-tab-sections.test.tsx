import { render, screen } from "@testing-library/react";
import type { VisibilityCheck, VisibilityGap } from "@/lib/api";
import {
  ScheduledChecksSection,
  VisibilityFreshnessSummary,
  VisibilityHistorySection,
} from "./visibility-tab-sections";
import {
  VisibilityContentGapsSection,
  VisibilityResultCard,
} from "./visibility-tab-analysis";

describe("visibility-tab sections", () => {
  it("renders the empty scheduled checks state", () => {
    render(
      <ScheduledChecksSection
        schedules={[]}
        scheduleError={null}
        onCreateSchedule={async () => {}}
        onToggleSchedule={async () => {}}
        onDeleteSchedule={async () => {}}
      />,
    );

    expect(screen.getByText("Scheduled Checks")).toBeInTheDocument();
    expect(screen.getByText("No scheduled checks yet")).toBeInTheDocument();
  });

  it("renders result details and competitor mentions", () => {
    const check = {
      id: "check-1",
      llmProvider: "chatgpt",
      brandMentioned: true,
      urlCited: false,
      citationPosition: 2,
      responseText: "a".repeat(520),
      competitorMentions: [
        { domain: "example.com", mentioned: true, position: 3 },
        { domain: "other.com", mentioned: false, position: null },
      ],
    } as VisibilityCheck;

    render(<VisibilityResultCard check={check} />);

    expect(screen.getByText("Mentioned")).toBeInTheDocument();
    expect(screen.getByText("Not Cited")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText(/Found \(#3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Not found/)).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) => content.length > 500 && content.endsWith("..."),
      ),
    ).toBeInTheDocument();
  });

  it("renders the visibility freshness summary metadata", () => {
    render(
      <VisibilityFreshnessSummary
        historyLoaded
        visibilityMeta={{
          checks: 12,
          providerCount: 4,
          queryCount: 6,
          latestCheckedAt: "2024-01-01T00:00:00.000Z",
          confidence: { label: "High", variant: "success" },
        }}
      />,
    );

    expect(screen.getByText(/Checks sampled: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Provider diversity: 4\/7/)).toBeInTheDocument();
    expect(screen.getByText(/Query coverage: 6/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: High/)).toBeInTheDocument();
  });

  it("renders previous visibility checks in a history table", () => {
    const history = [
      {
        id: "history-1",
        query: "best llm rank tools",
        llmProvider: "claude",
        brandMentioned: true,
        urlCited: false,
        checkedAt: "2024-02-10T00:00:00.000Z",
      },
    ] as VisibilityCheck[];

    render(<VisibilityHistorySection historyLoaded history={history} />);

    expect(screen.getByText("Previous Checks")).toBeInTheDocument();
    expect(screen.getByText("best llm rank tools")).toBeInTheDocument();
    expect(screen.getByText("claude")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders content gaps with cited competitors", () => {
    const gaps = [
      {
        query: "how to improve ai visibility",
        providers: ["chatgpt"],
        userMentioned: false,
        userCited: false,
        competitorsCited: [{ domain: "example.com", position: 1 }],
      },
    ] as VisibilityGap[];

    render(<VisibilityContentGapsSection gaps={gaps} />);

    expect(screen.getByText("Content Gaps")).toBeInTheDocument();
    expect(
      screen.getByText(/how to improve ai visibility/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Competitors cited: example.com/),
    ).toBeInTheDocument();
  });
});
