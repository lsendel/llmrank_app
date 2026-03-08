import { render, screen } from "@testing-library/react";
import type { VisibilityCheck } from "@/lib/api";
import {
  ScheduledChecksSection,
  VisibilityResultCard,
} from "./visibility-tab-sections";

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
});
