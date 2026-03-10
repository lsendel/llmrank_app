"use client";

import { useCallback, useMemo, useState } from "react";
import { useUser } from "@/lib/auth-hooks";
import { api, type ActionItem, type PageScoreDetail } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { useToast } from "@/components/ui/use-toast";
import {
  buildActionItemIndex,
  buildOptimizationDrafts,
  buildOptimizationTaskItems,
  buildOptimizationTasks,
  buildPageIssueByCode,
  defaultDueAtIsoBySeverity,
  getActionItemForCode,
  type OptimizationTask,
} from "./page-optimization-workspace-helpers";

export function usePageOptimizationWorkspaceState({
  page,
  projectId,
}: {
  page: PageScoreDetail;
  projectId: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [userOverrides, setUserOverrides] = useState<Record<string, string>>(
    {},
  );
  const [implemented, setImplemented] = useState<Record<string, boolean>>({});
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>(
    {},
  );
  const [savingTaskKey, setSavingTaskKey] = useState<string | null>(null);

  const { data: actionItems, mutate: mutateActionItems } = useApiSWR<
    ActionItem[]
  >(
    `page-optimization-action-items-${projectId}`,
    useCallback(() => api.actionItems.list(projectId), [projectId]),
  );

  const actionItemIndex = useMemo(
    () => buildActionItemIndex(actionItems),
    [actionItems],
  );
  const pageIssueByCode = useMemo(
    () => buildPageIssueByCode(page.issues),
    [page.issues],
  );
  const tasks = useMemo(() => buildOptimizationTasks(page), [page]);
  const items = useMemo(
    () => buildOptimizationTaskItems(tasks, page.id, actionItemIndex),
    [actionItemIndex, page.id, tasks],
  );
  const drafts = useMemo(
    () => buildOptimizationDrafts(tasks, userOverrides),
    [tasks, userOverrides],
  );

  const handleSuggestedChange = useCallback(
    (taskKey: string, value: string) => {
      setUserOverrides((current) => ({ ...current, [taskKey]: value }));
    },
    [],
  );

  const handleMarkImplemented = useCallback((taskKey: string) => {
    setImplemented((current) => ({ ...current, [taskKey]: true }));
  }, []);

  const handleDueDateChange = useCallback((taskKey: string, value: string) => {
    setDueDateDrafts((current) => ({ ...current, [taskKey]: value }));
  }, []);

  const handleCopySuggested = useCallback(
    (taskKey: string) => {
      navigator.clipboard
        .writeText(drafts[taskKey] ?? "")
        .catch(() => undefined);
    },
    [drafts],
  );

  const handleSaveTask = useCallback(
    async (task: OptimizationTask) => {
      if (!task.issueCode) return;

      setSavingTaskKey(task.key);
      const dueDate = dueDateDrafts[task.key];
      const dueAt = dueDate
        ? new Date(`${dueDate}T12:00:00.000Z`).toISOString()
        : null;
      const pageIssue = pageIssueByCode.get(task.issueCode);

      try {
        const existing = getActionItemForCode(
          actionItemIndex,
          task.issueCode,
          page.id,
        );

        if (existing) {
          await api.actionItems.update(existing.id, {
            assigneeId: user?.id ?? null,
            dueAt,
            description: drafts[task.key] ?? null,
            status: existing.status,
          });
        } else {
          await api.actionItems.create({
            projectId,
            pageId: page.id,
            issueCode: task.issueCode,
            status: "pending",
            severity: pageIssue?.severity ?? "warning",
            category: pageIssue?.category ?? "technical",
            scoreImpact: Math.round(task.impactScore),
            title: pageIssue?.message ?? `${task.label} optimization`,
            description: drafts[task.key] ?? task.rationale,
            assigneeId: user?.id ?? null,
            dueAt:
              dueAt ??
              defaultDueAtIsoBySeverity(pageIssue?.severity ?? "warning"),
          });
        }

        await mutateActionItems();
        toast({
          title: "Task saved",
          description: `${task.label} task updated with owner and due date.`,
        });
      } catch (err) {
        toast({
          title: "Task update failed",
          description:
            err instanceof Error
              ? err.message
              : "Could not save action item controls.",
          variant: "destructive",
        });
      } finally {
        setSavingTaskKey(null);
      }
    },
    [
      actionItemIndex,
      drafts,
      dueDateDrafts,
      mutateActionItems,
      page.id,
      pageIssueByCode,
      projectId,
      toast,
      user?.id,
    ],
  );

  return {
    drafts,
    dueDateDrafts,
    handleCopySuggested,
    handleDueDateChange,
    handleMarkImplemented,
    handleSaveTask,
    handleSuggestedChange,
    implemented,
    items,
    savingTaskKey,
  };
}
