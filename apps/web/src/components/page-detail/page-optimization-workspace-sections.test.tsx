import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActionItem } from "@/lib/api";
import { PageOptimizationTaskList } from "./page-optimization-workspace-sections";
import type { OptimizationTaskItem } from "./page-optimization-workspace-helpers";

vi.mock("@/components/ai-fix-button", () => ({
  AiFixButton: ({ issueTitle }: { issueTitle: string }) => (
    <div>AI Fix {issueTitle}</div>
  ),
}));

const actionItem: ActionItem = {
  id: "item-1",
  projectId: "proj-1",
  pageId: "page-1",
  issueCode: "MISSING_TITLE",
  status: "in_progress",
  severity: "warning",
  category: "content",
  scoreImpact: 80,
  title: "Title task",
  description: null,
  assigneeId: "user-1",
  dueAt: "2026-03-20T12:00:00.000Z",
  verifiedAt: null,
  verifiedByCrawlId: null,
  createdAt: "2026-03-09T00:00:00.000Z",
  updatedAt: "2026-03-09T00:00:00.000Z",
};

const items: OptimizationTaskItem[] = [
  {
    task: {
      key: "title",
      label: "Title Tag",
      issueCode: "MISSING_TITLE",
      before: "Missing title",
      suggested: "Add a strong page title",
      impactScore: 82,
      rationale: "Titles improve discoverability.",
    },
    actionItem,
  },
];

describe("page optimization workspace sections", () => {
  it("renders task controls and forwards callbacks", () => {
    const onSuggestedChange = vi.fn();
    const onCopySuggested = vi.fn();
    const onMarkImplemented = vi.fn();
    const onDueDateChange = vi.fn();
    const onSaveTask = vi.fn(async () => undefined);

    render(
      <PageOptimizationTaskList
        items={items}
        drafts={{ title: "Add a strong page title" }}
        implemented={{ title: true }}
        dueDateDrafts={{}}
        savingTaskKey={null}
        pageId="page-1"
        projectId="proj-1"
        onSuggestedChange={onSuggestedChange}
        onCopySuggested={onCopySuggested}
        onMarkImplemented={onMarkImplemented}
        onDueDateChange={onDueDateChange}
        onSaveTask={onSaveTask}
      />,
    );

    expect(screen.getByText("Title Tag")).toBeInTheDocument();
    expect(screen.getByText("AI Fix Title Tag")).toBeInTheDocument();
    expect(screen.getByText("Implemented")).toBeInTheDocument();
    expect(screen.getByText("Status: in_progress")).toBeInTheDocument();
    expect(screen.getByText("Owner: Assigned")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Add a strong page title"), {
      target: { value: "Updated title copy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy Suggested" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Implemented" }));
    fireEvent.change(screen.getByDisplayValue("2026-03-20"), {
      target: { value: "2026-03-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Task Plan" }));

    expect(onSuggestedChange).toHaveBeenCalledWith(
      "title",
      "Updated title copy",
    );
    expect(onCopySuggested).toHaveBeenCalledWith("title");
    expect(onMarkImplemented).toHaveBeenCalledWith("title");
    expect(onDueDateChange).toHaveBeenCalledWith("title", "2026-03-25");
    expect(onSaveTask).toHaveBeenCalledWith(items[0]!.task);
  });
});
