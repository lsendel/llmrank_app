"use client";

import { ScoringProfileCard } from "./scoring-profile-section-sections";
import { useScoringProfileSectionState } from "./use-scoring-profile-section-state";

export function ScoringProfileSection({
  projectId: _projectId,
}: {
  projectId: string;
}) {
  const state = useScoringProfileSectionState();

  return (
    <ScoringProfileCard
      weights={state.weights}
      preset={state.preset}
      showCustomEditor={state.showCustomEditor}
      saving={state.saving}
      total={state.total}
      isValid={state.isValid}
      onPresetChange={state.handlePresetChange}
      onToggleCustomEditor={state.handleToggleCustomEditor}
      onWeightChange={state.handleWeightChange}
      onSave={state.handleSave}
    />
  );
}
