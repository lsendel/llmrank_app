import { useCallback, useMemo, useState } from "react";
import {
  api,
  type ActionItem,
  type ActionItemStats,
  type PageIssue,
} from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  buildActionItemIndex,
  filterIssues,
  getActionItemForIssue,
  type IssueCategoryFilter,
  type IssueSeverityFilter,
  type StatusFilter,
} from "./issues-tab-helpers";

type UseIssuesTabDataArgs = {
  issues: PageIssue[];
  projectId?: string;
};

export function useIssuesTabData({ issues, projectId }: UseIssuesTabDataArgs) {
  const [severityFilter, setSeverityFilter] =
    useState<IssueSeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<IssueCategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: actionItems, mutate: mutateItems } = useApiSWR<ActionItem[]>(
    projectId ? `action-items-${projectId}` : null,
    useCallback(() => api.actionItems.list(projectId!), [projectId]),
  );

  const { data: stats, mutate: mutateStats } = useApiSWR<ActionItemStats>(
    projectId ? `action-item-stats-${projectId}` : null,
    useCallback(() => api.actionItems.stats(projectId!), [projectId]),
  );

  const actionItemIndex = useMemo(
    () => buildActionItemIndex(actionItems),
    [actionItems],
  );

  const getActionItemForIssueForTab = useCallback(
    (issue: PageIssue) => getActionItemForIssue(issue, actionItemIndex),
    [actionItemIndex],
  );

  const highPriorityBacklog = useMemo(
    () =>
      issues.filter((issue) => {
        const isHighPriority =
          issue.severity === "critical" || issue.severity === "warning";
        return isHighPriority && !getActionItemForIssueForTab(issue);
      }),
    [issues, getActionItemForIssueForTab],
  );

  const filteredIssues = useMemo(
    () =>
      filterIssues({
        issues,
        severityFilter,
        categoryFilter,
        statusFilter,
        getActionItemForIssue: getActionItemForIssueForTab,
      }),
    [
      issues,
      severityFilter,
      categoryFilter,
      statusFilter,
      getActionItemForIssueForTab,
    ],
  );

  return {
    severityFilter,
    setSeverityFilter,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    actionItems,
    stats,
    mutateItems,
    mutateStats,
    getActionItemForIssue: getActionItemForIssueForTab,
    highPriorityBacklog,
    filteredIssues,
  };
}
