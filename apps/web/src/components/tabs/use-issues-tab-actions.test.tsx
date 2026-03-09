import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ActionItem, type PageIssue } from "@/lib/api";
import { useIssuesTabActions } from "./use-issues-tab-actions";

const { toastMock, trackMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  trackMock: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: trackMock,
}));

describe("useIssuesTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    api.actionItems.updateStatus = vi.fn(async () => ({}) as ActionItem);
    api.actionItems.update = vi.fn(async () => ({}) as ActionItem);
    api.actionItems.create = vi.fn(async () => ({}) as ActionItem);
    api.actionItems.bulkCreate = vi.fn(async () => ({
      items: [],
      created: 0,
      updated: 0,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates status, refreshes data, and tracks fixes", async () => {
    const mutateItems = vi.fn(async () => undefined);
    const mutateStats = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useIssuesTabActions({
        projectId: "proj-1",
        currentUserId: "user-1",
        actionItems: [
          {
            id: "task-1",
            projectId: "proj-1",
            pageId: null,
            issueCode: "MISSING_TITLE",
            status: "pending",
            severity: "critical",
            category: "technical",
            scoreImpact: 0,
            title: "Fix title",
            description: null,
            assigneeId: null,
            dueAt: null,
            verifiedAt: null,
            verifiedByCrawlId: null,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        highPriorityBacklog: [],
        mutateItems,
        mutateStats,
      }),
    );

    await act(async () => {
      await result.current.handleStatusChange("task-1", "fixed");
    });

    expect(api.actionItems.updateStatus).toHaveBeenCalledWith(
      "task-1",
      "fixed",
    );
    expect(trackMock).toHaveBeenCalledWith("fix_applied", {
      projectId: "proj-1",
      actionItemId: "task-1",
      issueCode: "MISSING_TITLE",
      source: "issues_tab",
    });
    expect(mutateItems).toHaveBeenCalledTimes(1);
    expect(mutateStats).toHaveBeenCalledTimes(1);
  });

  it("creates and updates tasks with current-user mapping and default due dates", async () => {
    const mutateItems = vi.fn(async () => undefined);
    const mutateStats = vi.fn(async () => undefined);
    const issue = {
      code: "THIN_CONTENT",
      category: "content",
      severity: "warning",
      message: "Thin content",
      recommendation: "Expand page",
      pageId: "page-1",
    } satisfies PageIssue;

    const { result } = renderHook(() =>
      useIssuesTabActions({
        projectId: "proj-1",
        currentUserId: "user-1",
        actionItems: [],
        highPriorityBacklog: [],
        mutateItems,
        mutateStats,
      }),
    );

    await act(async () => {
      await result.current.handleCreateTask(issue, {
        assigneeId: "me",
        dueAt: null,
      });
    });

    expect(api.actionItems.create).toHaveBeenCalledWith({
      projectId: "proj-1",
      pageId: "page-1",
      issueCode: "THIN_CONTENT",
      status: "pending",
      severity: "warning",
      category: "content",
      scoreImpact: 0,
      title: "Thin content",
      description: "Expand page",
      assigneeId: "user-1",
      dueAt: "2024-01-08T12:00:00.000Z",
    });

    await act(async () => {
      await result.current.handleTaskUpdate("task-1", {
        assigneeId: "me",
        dueAt: "2024-02-01T12:00:00.000Z",
      });
    });

    expect(api.actionItems.update).toHaveBeenCalledWith("task-1", {
      assigneeId: "user-1",
      dueAt: "2024-02-01T12:00:00.000Z",
    });
  });

  it("bulk-plans high-priority backlog and shows success feedback", async () => {
    const mutateItems = vi.fn(async () => undefined);
    const mutateStats = vi.fn(async () => undefined);
    const highPriorityBacklog = [
      {
        code: "MISSING_TITLE",
        category: "technical",
        severity: "critical",
        message: "Missing title",
        recommendation: "Add a title",
        pageId: "page-1",
      },
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        message: "Thin content",
        recommendation: "Expand page",
        pageId: "page-2",
      },
    ] satisfies PageIssue[];

    api.actionItems.bulkCreate = vi.fn(async () => ({
      items: [],
      created: 1,
      updated: 1,
    }));

    const { result } = renderHook(() =>
      useIssuesTabActions({
        projectId: "proj-1",
        currentUserId: "user-1",
        actionItems: [],
        highPriorityBacklog,
        mutateItems,
        mutateStats,
      }),
    );

    await act(async () => {
      await result.current.handleAutoPlanHighPriority();
    });

    expect(api.actionItems.bulkCreate).toHaveBeenCalledWith({
      projectId: "proj-1",
      items: [
        {
          pageId: "page-1",
          issueCode: "MISSING_TITLE",
          status: "pending",
          severity: "critical",
          category: "technical",
          scoreImpact: 0,
          title: "Missing title",
          description: "Add a title",
          assigneeId: "user-1",
          dueAt: "2024-01-04T12:00:00.000Z",
        },
        {
          pageId: "page-2",
          issueCode: "THIN_CONTENT",
          status: "pending",
          severity: "warning",
          category: "content",
          scoreImpact: 0,
          title: "Thin content",
          description: "Expand page",
          assigneeId: "user-1",
          dueAt: "2024-01-08T12:00:00.000Z",
        },
      ],
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "High-priority tasks planned",
      description: "Processed 2 tasks with owners and due dates.",
    });
    expect(result.current.autoPlanning).toBe(false);
  });
});
