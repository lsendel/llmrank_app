import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  api,
  type ActionItem,
  type ActionItemStatus,
  type PageIssue,
} from "@/lib/api";
import { track } from "@/lib/telemetry";
import {
  MAX_AUTO_PLAN_ITEMS,
  defaultDueAtIsoBySeverity,
} from "./issues-tab-helpers";

type AsyncMutator = () => Promise<unknown> | unknown;

type UseIssuesTabActionsArgs = {
  projectId?: string;
  currentUserId: string | null;
  actionItems: ActionItem[] | undefined;
  highPriorityBacklog: PageIssue[];
  mutateItems: AsyncMutator;
  mutateStats: AsyncMutator;
};

export function useIssuesTabActions({
  projectId,
  currentUserId,
  actionItems,
  highPriorityBacklog,
  mutateItems,
  mutateStats,
}: UseIssuesTabActionsArgs) {
  const { toast } = useToast();
  const [autoPlanning, setAutoPlanning] = useState(false);

  const refreshActionItems = useCallback(async () => {
    await Promise.all([mutateItems(), mutateStats()]);
  }, [mutateItems, mutateStats]);

  const handleStatusChange = useCallback(
    async (actionItemId: string, newStatus: ActionItemStatus) => {
      await api.actionItems.updateStatus(actionItemId, newStatus);

      if (newStatus === "fixed") {
        const item = (actionItems ?? []).find(
          (candidate) => candidate.id === actionItemId,
        );
        track("fix_applied", {
          projectId,
          actionItemId,
          issueCode: item?.issueCode ?? null,
          source: "issues_tab",
        });
      }

      await refreshActionItems();
    },
    [actionItems, projectId, refreshActionItems],
  );

  const handleTaskUpdate = useCallback(
    async (
      actionItemId: string,
      updates: {
        assigneeId?: string | null;
        dueAt?: string | null;
      },
    ) => {
      const assigneeId =
        updates.assigneeId === "me" ? currentUserId : updates.assigneeId;

      await api.actionItems.update(actionItemId, {
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        ...(updates.dueAt !== undefined ? { dueAt: updates.dueAt } : {}),
      });

      await refreshActionItems();
    },
    [currentUserId, refreshActionItems],
  );

  const handleCreateTask = useCallback(
    async (
      issue: PageIssue,
      args: {
        assigneeId: string | null;
        dueAt: string | null;
      },
    ) => {
      if (!projectId) return;

      const assigneeId = args.assigneeId === "me" ? currentUserId : null;
      await api.actionItems.create({
        projectId,
        pageId: issue.pageId ?? null,
        issueCode: issue.code,
        status: "pending",
        severity: issue.severity,
        category: issue.category,
        scoreImpact: 0,
        title: issue.message,
        description: issue.recommendation,
        assigneeId,
        dueAt: args.dueAt ?? defaultDueAtIsoBySeverity(issue.severity),
      });

      await refreshActionItems();
    },
    [currentUserId, projectId, refreshActionItems],
  );

  const handleAutoPlanHighPriority = useCallback(async () => {
    if (!projectId || highPriorityBacklog.length === 0) return;

    setAutoPlanning(true);
    const candidates = highPriorityBacklog.slice(0, MAX_AUTO_PLAN_ITEMS);

    try {
      const result = await api.actionItems.bulkCreate({
        projectId,
        items: candidates.map((issue) => ({
          pageId: issue.pageId ?? null,
          issueCode: issue.code,
          status: "pending",
          severity: issue.severity,
          category: issue.category,
          scoreImpact: 0,
          title: issue.message,
          description: issue.recommendation,
          assigneeId: currentUserId,
          dueAt: defaultDueAtIsoBySeverity(issue.severity),
        })),
      });

      await refreshActionItems();

      const remaining = highPriorityBacklog.length - candidates.length;
      const upsertedCount = result.created + result.updated;
      if (upsertedCount > 0) {
        toast({
          title: "High-priority tasks planned",
          description:
            remaining > 0
              ? `Processed ${upsertedCount} tasks. ${remaining} additional issues remain for the next batch.`
              : `Processed ${upsertedCount} tasks with owners and due dates.`,
        });
      } else {
        toast({
          title: "No changes applied",
          description:
            "The selected high-priority issues were already covered by open tasks.",
        });
      }
    } catch (err) {
      toast({
        title: "Task planning failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not create high-priority task plans.",
        variant: "destructive",
      });
    } finally {
      setAutoPlanning(false);
    }
  }, [
    currentUserId,
    highPriorityBacklog,
    projectId,
    refreshActionItems,
    toast,
  ]);

  return {
    autoPlanning,
    handleStatusChange,
    handleTaskUpdate,
    handleCreateTask,
    handleAutoPlanHighPriority,
  };
}
