"use client";

import {
  AutomationFailedStepsSection,
  AutomationHealthSection,
  AutomationRecentRunsSection,
  AutomationSettingsSection,
  AutomationStatusSection,
} from "./automation-tab-sections";
import { useAutomationTabActions } from "./use-automation-tab-actions";
import { useAutomationTabData } from "./use-automation-tab-data";

export function AutomationTab({ projectId }: { projectId: string }) {
  const {
    latestRun,
    runs,
    savedAutoRun,
    savedKnownSkipSteps,
    savedUnknownSkipSteps,
    failedSteps,
    totalRuns,
    failedRuns,
    successRate,
    settingsReady,
    mutateProject,
    mutateLatest,
    mutateRuns,
  } = useAutomationTabData(projectId);

  const {
    isRerunning,
    healthResult,
    healthLoading,
    actionError,
    lastFailedAction,
    autoRunOnCrawl,
    setAutoRunOnCrawl,
    skipSteps,
    settingsSaving,
    settingsError,
    settingsDirty,
    handleRerun,
    handleHealthCheck,
    handleSkipStepToggle,
    handleResetSettings,
    handleSaveSettings,
    retryLastAction,
  } = useAutomationTabActions({
    projectId,
    savedAutoRun,
    savedKnownSkipSteps,
    savedUnknownSkipSteps,
    mutateLatest,
    mutateRuns,
    mutateProject,
  });
  const settingsControlsDisabled = !settingsReady || settingsSaving;

  return (
    <div className="space-y-6">
      <AutomationStatusSection
        latestRun={latestRun}
        totalRuns={totalRuns}
        successRate={successRate}
        failedRuns={failedRuns}
        isRerunning={isRerunning}
        healthLoading={healthLoading}
        actionError={actionError}
        retryDisabled={
          lastFailedAction === null || isRerunning || healthLoading
        }
        onRerun={() => void handleRerun()}
        onHealthCheck={() => void handleHealthCheck()}
        onRetryAction={retryLastAction}
      />

      <AutomationSettingsSection
        settingsReady={settingsReady}
        autoRunOnCrawl={autoRunOnCrawl}
        settingsControlsDisabled={settingsControlsDisabled}
        skipSteps={skipSteps}
        savedUnknownSkipSteps={savedUnknownSkipSteps}
        settingsError={settingsError}
        settingsSaving={settingsSaving}
        settingsDirty={settingsDirty}
        onAutoRunChange={setAutoRunOnCrawl}
        onToggleSkipStep={handleSkipStepToggle}
        onReset={handleResetSettings}
        onSave={handleSaveSettings}
      />

      <AutomationFailedStepsSection
        projectId={projectId}
        failedSteps={failedSteps}
      />

      <AutomationHealthSection healthResult={healthResult} />

      <AutomationRecentRunsSection runs={runs} />
    </div>
  );
}
