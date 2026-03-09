"use client";

import dynamic from "next/dynamic";

const IssueHeatmap = dynamic(
  () =>
    import("@/components/charts/issue-heatmap").then((m) => ({
      default: m.IssueHeatmap,
    })),
  { ssr: false },
);
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { usePlan } from "@/hooks/use-plan";
import { useUser } from "@/lib/auth-hooks";
import { type PageIssue } from "@/lib/api";
import {
  IssuesAutoPlanBanner,
  IssuesExecutionLaneSummary,
  IssuesFilters,
  IssuesFixRateBanner,
  IssuesList,
} from "./issues-tab-sections";
import { useIssuesTabActions } from "./use-issues-tab-actions";
import { useIssuesTabData } from "./use-issues-tab-data";

// ---------------------------------------------------------------------------
// Issues Tab
// ---------------------------------------------------------------------------

export function IssuesTab({
  issues,
  crawlId,
  projectId,
}: {
  issues: PageIssue[];
  crawlId?: string;
  projectId?: string;
}) {
  const { user } = useUser();
  const currentUserId = user?.id ?? null;
  const { isFree } = usePlan();
  const {
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
    getActionItemForIssue,
    highPriorityBacklog,
    filteredIssues,
  } = useIssuesTabData({ issues, projectId });
  const {
    autoPlanning,
    handleStatusChange,
    handleTaskUpdate,
    handleCreateTask,
    handleAutoPlanHighPriority,
  } = useIssuesTabActions({
    projectId,
    currentUserId,
    actionItems,
    highPriorityBacklog,
    mutateItems,
    mutateStats,
  });

  return (
    <div className="space-y-4">
      {stats && stats.total > 0 && <IssuesFixRateBanner stats={stats} />}
      {actionItems && actionItems.length > 0 && (
        <IssuesExecutionLaneSummary items={actionItems} />
      )}
      <IssuesAutoPlanBanner
        backlogCount={highPriorityBacklog.length}
        autoPlanning={autoPlanning}
        onAutoPlan={handleAutoPlanHighPriority}
      />

      {crawlId && projectId && (
        <IssueHeatmap crawlId={crawlId} projectId={projectId} />
      )}

      {isFree && (
        <UpgradePrompt
          feature="AI-Powered Issue Priority"
          description="Sort issues by AI-estimated impact to fix the most important problems first."
          nextTier="Starter ($79/mo)"
          nextTierUnlocks="AI priority sorting, 100 pages/crawl, 10 crawls/month"
        />
      )}

      <IssuesFilters
        severityFilter={severityFilter}
        categoryFilter={categoryFilter}
        statusFilter={statusFilter}
        showStatusFilter={(actionItems?.length ?? 0) > 0}
        onSeverityChange={setSeverityFilter}
        onCategoryChange={setCategoryFilter}
        onStatusChange={setStatusFilter}
      />

      <IssuesList
        issues={issues}
        filteredIssues={filteredIssues}
        projectId={projectId}
        getActionItemForIssue={getActionItemForIssue}
        onStatusChange={handleStatusChange}
        onTaskCreate={handleCreateTask}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  );
}
