import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionItem, ActionItemStats, PageIssue } from "@/lib/api";
import { useIssuesTabData } from "./use-issues-tab-data";

const { mockUseApiSWR } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useIssuesTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads action items and derives scoped matches, backlog, and filtered results", () => {
    const issues = [
      {
        code: "MISSING_TITLE",
        category: "technical",
        severity: "critical",
        message: "Missing title",
        recommendation: "Add a title",
        pageId: "page-1",
      },
      {
        code: "MISSING_TITLE",
        category: "technical",
        severity: "critical",
        message: "Missing title on second page",
        recommendation: "Add a title",
        pageId: "page-2",
      },
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        message: "Thin content",
        recommendation: "Expand page",
      },
    ] satisfies PageIssue[];

    const actionItems = [
      {
        id: "task-1",
        projectId: "proj-1",
        pageId: "page-1",
        issueCode: "MISSING_TITLE",
        status: "in_progress",
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
    ] satisfies ActionItem[];

    const stats = {
      total: 1,
      fixed: 0,
      inProgress: 1,
      dismissed: 0,
      pending: 0,
      fixRate: 0,
    } satisfies ActionItemStats;

    const mutateItems = vi.fn();
    const mutateStats = vi.fn();

    mockUseApiSWR.mockImplementation((key: string | null) => {
      if (key === "action-items-proj-1") {
        return { data: actionItems, mutate: mutateItems };
      }
      if (key === "action-item-stats-proj-1") {
        return { data: stats, mutate: mutateStats };
      }
      return { data: undefined, mutate: vi.fn() };
    });

    const { result } = renderHook(() =>
      useIssuesTabData({ issues, projectId: "proj-1" }),
    );

    expect(result.current.actionItems).toEqual(actionItems);
    expect(result.current.stats).toEqual(stats);
    expect(result.current.getActionItemForIssue(issues[0])?.id).toBe("task-1");
    expect(result.current.getActionItemForIssue(issues[1])).toBeUndefined();
    expect(
      result.current.highPriorityBacklog.map((issue) => issue.message),
    ).toEqual(["Missing title on second page", "Thin content"]);
    expect(result.current.filteredIssues).toHaveLength(3);
  });

  it("updates filtered results when filter state changes", () => {
    const issues = [
      {
        code: "MISSING_TITLE",
        category: "technical",
        severity: "critical",
        message: "Missing title",
        recommendation: "Add a title",
      },
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        message: "Thin content",
        recommendation: "Expand page",
      },
      {
        code: "BROKEN_SCHEMA",
        category: "ai_readiness",
        severity: "info",
        message: "Broken schema",
        recommendation: "Fix schema",
      },
    ] satisfies PageIssue[];

    const actionItems = [
      {
        id: "task-1",
        projectId: "proj-1",
        pageId: null,
        issueCode: "BROKEN_SCHEMA",
        status: "fixed",
        severity: "info",
        category: "ai_readiness",
        scoreImpact: 0,
        title: "Schema",
        description: null,
        assigneeId: null,
        dueAt: null,
        verifiedAt: null,
        verifiedByCrawlId: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ] satisfies ActionItem[];

    mockUseApiSWR.mockImplementation((key: string | null) => {
      if (key === "action-items-proj-1") {
        return { data: actionItems, mutate: vi.fn() };
      }
      if (key === "action-item-stats-proj-1") {
        return { data: undefined, mutate: vi.fn() };
      }
      return { data: undefined, mutate: vi.fn() };
    });

    const { result } = renderHook(() =>
      useIssuesTabData({ issues, projectId: "proj-1" }),
    );

    act(() => {
      result.current.setSeverityFilter("warning");
      result.current.setCategoryFilter("content");
    });

    expect(result.current.filteredIssues.map((issue) => issue.code)).toEqual([
      "THIN_CONTENT",
    ]);

    act(() => {
      result.current.setSeverityFilter("all");
      result.current.setCategoryFilter("all");
      result.current.setStatusFilter("fixed");
    });

    expect(result.current.filteredIssues.map((issue) => issue.code)).toEqual([
      "BROKEN_SCHEMA",
    ]);
  });
});
