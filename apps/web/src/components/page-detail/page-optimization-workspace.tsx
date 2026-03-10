"use client";

import type { PageScoreDetail } from "@/lib/api";
import { PageOptimizationTaskList } from "./page-optimization-workspace-sections";
import { usePageOptimizationWorkspaceState } from "./use-page-optimization-workspace-state";

interface PageOptimizationWorkspaceProps {
  page: PageScoreDetail;
  projectId: string;
}

export function PageOptimizationWorkspace({
  page,
  projectId,
}: PageOptimizationWorkspaceProps) {
  const {
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
  } = usePageOptimizationWorkspaceState({ page, projectId });

  return (
    <PageOptimizationTaskList
      items={items}
      drafts={drafts}
      implemented={implemented}
      dueDateDrafts={dueDateDrafts}
      savingTaskKey={savingTaskKey}
      pageId={page.id}
      projectId={projectId}
      onSuggestedChange={handleSuggestedChange}
      onCopySuggested={handleCopySuggested}
      onMarkImplemented={handleMarkImplemented}
      onDueDateChange={handleDueDateChange}
      onSaveTask={handleSaveTask}
    />
  );
}
