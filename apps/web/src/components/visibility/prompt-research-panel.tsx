"use client";

import { ApiError } from "@/lib/api";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import {
  PromptResearchEmptyStateCard,
  PromptResearchLoadingCard,
  PromptResearchResultsCard,
} from "./prompt-research-panel-sections";
import { usePromptResearchPanelState } from "./use-prompt-research-panel-state";

export function PromptResearchPanel({
  projectId,
  filters,
}: {
  projectId: string;
  filters?: { region?: string; language?: string };
}) {
  const state = usePromptResearchPanelState({ projectId, filters });

  // Plan gate
  if (state.error instanceof ApiError && state.error.status === 403) {
    return (
      <UpgradePrompt
        feature="Prompt Research"
        description="Discover what questions people ask AI about your industry — find prompt opportunities before your competitors."
        nextTier="Starter ($79/mo)"
        nextTierUnlocks="Up to 20 discovered prompts, visibility tracking, 100 pages/crawl"
      />
    );
  }

  if (state.isLoading) {
    return <PromptResearchLoadingCard />;
  }

  if (state.prompts.length === 0) {
    return (
      <PromptResearchEmptyStateCard
        isDiscovering={state.isDiscovering}
        onDiscover={state.handleDiscover}
      />
    );
  }

  return (
    <PromptResearchResultsCard
      prompts={state.prompts}
      filteredPrompts={state.filteredPrompts}
      meta={state.meta}
      categoryFilter={state.categoryFilter}
      mentionedFilter={state.mentionedFilter}
      difficultyFilter={state.difficultyFilter}
      isDiscovering={state.isDiscovering}
      runningPromptId={state.runningPromptId}
      trackingPromptId={state.trackingPromptId}
      onCategoryFilterChange={state.handleCategoryFilterChange}
      onMentionedFilterChange={state.handleMentionedFilterChange}
      onDifficultyFilterChange={state.handleDifficultyFilterChange}
      onExportCsv={state.handleExportCsv}
      onDiscover={state.handleDiscover}
      onRunCheck={state.handleRunCheck}
      onTrackPrompt={state.handleTrackPrompt}
      onDelete={state.handleDelete}
    />
  );
}
