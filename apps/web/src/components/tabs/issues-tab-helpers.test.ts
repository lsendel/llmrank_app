import { describe, expect, it, vi } from "vitest";
import type { ActionItem, PageIssue } from "@/lib/api";
import {
  buildActionItemIndex,
  defaultDueAtIsoBySeverity,
  filterIssues,
  getActionItemForIssue,
  summarizeExecutionLanes,
} from "./issues-tab-helpers";

describe("issues-tab helpers", () => {
  it("prefers page-scoped action items and avoids falling back when a scoped issue code exists", () => {
    const issueOnFirstPage = {
      code: "MISSING_TITLE",
      category: "technical",
      severity: "critical",
      message: "Missing title",
      recommendation: "Add a title",
      pageId: "page-1",
    } satisfies PageIssue;
    const issueOnSecondPage = {
      ...issueOnFirstPage,
      pageId: "page-2",
    } satisfies PageIssue;
    const issueWithoutPage = {
      code: "BLOCKED",
      category: "technical",
      severity: "warning",
      message: "Blocked",
      recommendation: "Unblock",
    } satisfies PageIssue;

    const actionItemIndex = buildActionItemIndex([
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
      {
        id: "task-2",
        projectId: "proj-1",
        pageId: null,
        issueCode: "BLOCKED",
        status: "fixed",
        severity: "warning",
        category: "technical",
        scoreImpact: 0,
        title: "Fix robots",
        description: null,
        assigneeId: null,
        dueAt: null,
        verifiedAt: null,
        verifiedByCrawlId: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ] satisfies ActionItem[]);

    expect(getActionItemForIssue(issueOnFirstPage, actionItemIndex)?.id).toBe(
      "task-1",
    );
    expect(
      getActionItemForIssue(issueOnSecondPage, actionItemIndex),
    ).toBeUndefined();
    expect(getActionItemForIssue(issueWithoutPage, actionItemIndex)?.id).toBe(
      "task-2",
    );
  });

  it("filters issues by severity, category, and action-item status", () => {
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
        message: "Schema issue",
        recommendation: "Fix schema",
      },
    ] satisfies PageIssue[];

    const statuses = new Map([
      ["MISSING_TITLE", { status: "in_progress" }],
      ["BROKEN_SCHEMA", { status: "fixed" }],
    ]);

    expect(
      filterIssues({
        issues,
        severityFilter: "all",
        categoryFilter: "all",
        statusFilter: "open",
        getActionItemForIssue: (issue) =>
          statuses.get(issue.code) as ActionItem | undefined,
      }).map((issue) => issue.code),
    ).toEqual(["THIN_CONTENT"]);

    expect(
      filterIssues({
        issues,
        severityFilter: "warning",
        categoryFilter: "content",
        statusFilter: "all",
        getActionItemForIssue: () => undefined,
      }).map((issue) => issue.code),
    ).toEqual(["THIN_CONTENT"]);
  });

  it("derives due dates and execution lane summary metrics", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    expect(defaultDueAtIsoBySeverity("critical")).toBe(
      "2024-01-04T12:00:00.000Z",
    );

    expect(
      summarizeExecutionLanes([
        {
          id: "task-1",
          projectId: "proj-1",
          pageId: null,
          issueCode: "A",
          status: "pending",
          severity: "critical",
          category: "technical",
          scoreImpact: 0,
          title: "A",
          description: null,
          assigneeId: null,
          dueAt: "2023-12-31T12:00:00.000Z",
          verifiedAt: null,
          verifiedByCrawlId: null,
          createdAt: "2023-12-10T00:00:00.000Z",
          updatedAt: "2023-12-10T00:00:00.000Z",
        },
        {
          id: "task-2",
          projectId: "proj-1",
          pageId: null,
          issueCode: "B",
          status: "in_progress",
          severity: "warning",
          category: "content",
          scoreImpact: 0,
          title: "B",
          description: null,
          assigneeId: "user-1",
          dueAt: "2024-01-10T12:00:00.000Z",
          verifiedAt: null,
          verifiedByCrawlId: null,
          createdAt: "2023-12-20T00:00:00.000Z",
          updatedAt: "2023-12-20T00:00:00.000Z",
        },
        {
          id: "task-3",
          projectId: "proj-1",
          pageId: null,
          issueCode: "C",
          status: "fixed",
          severity: "info",
          category: "performance",
          scoreImpact: 0,
          title: "C",
          description: null,
          assigneeId: null,
          dueAt: null,
          verifiedAt: null,
          verifiedByCrawlId: null,
          createdAt: "2023-12-01T00:00:00.000Z",
          updatedAt: "2023-12-01T00:00:00.000Z",
        },
      ] satisfies ActionItem[]),
    ).toEqual({
      openCount: 2,
      openOver14d: 1,
      ownerless: 1,
      overdue: 1,
    });

    vi.useRealTimers();
  });
});
