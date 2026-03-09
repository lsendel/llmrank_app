import type { ActionItem, PageIssue } from "@/lib/api";

export type StatusFilter = "all" | "open" | "in_progress" | "fixed";
export type IssueSeverityFilter = "all" | PageIssue["severity"];
export type IssueCategoryFilter = "all" | PageIssue["category"];

export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
];

export const ISSUE_SEVERITY_FILTERS: IssueSeverityFilter[] = [
  "all",
  "critical",
  "warning",
  "info",
];

export const ISSUE_CATEGORY_FILTERS: IssueCategoryFilter[] = [
  "all",
  "technical",
  "content",
  "ai_readiness",
  "performance",
];

export const MAX_AUTO_PLAN_ITEMS = 25;

export function defaultDueAtIsoBySeverity(
  severity: "critical" | "warning" | "info",
): string {
  const daysToAdd =
    severity === "critical" ? 3 : severity === "warning" ? 7 : 14;
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + daysToAdd);
  due.setUTCHours(12, 0, 0, 0);
  return due.toISOString();
}

export function actionItemIdentityKey(
  issueCode: string,
  pageId?: string | null,
) {
  return `${issueCode}::${pageId ?? ""}`;
}

type ActionItemIndex = {
  byIssuePage: Map<string, ActionItem>;
  legacyByIssue: Map<string, ActionItem>;
  scopedIssueCodes: Set<string>;
};

export function buildActionItemIndex(
  actionItems?: ActionItem[],
): ActionItemIndex {
  const byIssuePage = new Map<string, ActionItem>();
  const legacyByIssue = new Map<string, ActionItem>();
  const scopedIssueCodes = new Set<string>();

  for (const item of actionItems ?? []) {
    if (item.pageId) {
      const key = actionItemIdentityKey(item.issueCode, item.pageId);
      if (!byIssuePage.has(key)) {
        byIssuePage.set(key, item);
      }
      scopedIssueCodes.add(item.issueCode);
      continue;
    }

    if (!legacyByIssue.has(item.issueCode)) {
      legacyByIssue.set(item.issueCode, item);
    }
  }

  return { byIssuePage, legacyByIssue, scopedIssueCodes };
}

export function getActionItemForIssue(
  issue: PageIssue,
  actionItemIndex: ActionItemIndex,
): ActionItem | undefined {
  if (issue.pageId) {
    const scoped = actionItemIndex.byIssuePage.get(
      actionItemIdentityKey(issue.code, issue.pageId),
    );
    if (scoped) return scoped;

    if (actionItemIndex.scopedIssueCodes.has(issue.code)) {
      return undefined;
    }
  }

  return actionItemIndex.legacyByIssue.get(issue.code);
}

export function filterIssues(args: {
  issues: PageIssue[];
  severityFilter: IssueSeverityFilter;
  categoryFilter: IssueCategoryFilter;
  statusFilter: StatusFilter;
  getActionItemForIssue: (issue: PageIssue) => ActionItem | undefined;
}) {
  const {
    issues,
    severityFilter,
    categoryFilter,
    statusFilter,
    getActionItemForIssue,
  } = args;

  return issues.filter((issue) => {
    if (severityFilter !== "all" && issue.severity !== severityFilter) {
      return false;
    }
    if (categoryFilter !== "all" && issue.category !== categoryFilter) {
      return false;
    }

    if (statusFilter !== "all") {
      const actionItem = getActionItemForIssue(issue);
      const itemStatus = actionItem?.status ?? "pending";

      if (statusFilter === "open") {
        return itemStatus === "pending";
      }
      if (statusFilter === "in_progress") {
        return itemStatus === "in_progress";
      }
      return itemStatus === "fixed" || itemStatus === "dismissed";
    }

    return true;
  });
}

export function summarizeExecutionLanes(items: ActionItem[], now = Date.now()) {
  const openItems = items.filter(
    (item) => item.status === "pending" || item.status === "in_progress",
  );

  return {
    openCount: openItems.length,
    openOver14d: openItems.filter((item) => {
      const ageMs = now - new Date(item.createdAt).getTime();
      return ageMs > 14 * 24 * 60 * 60 * 1000;
    }).length,
    ownerless: openItems.filter((item) => !item.assigneeId).length,
    overdue: openItems.filter((item) => {
      if (!item.dueAt) return false;
      return new Date(item.dueAt).getTime() < now;
    }).length,
  };
}
