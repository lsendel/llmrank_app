import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  api,
  ApiError,
  type PipelineHealthCheckResult,
  type Project,
} from "@/lib/api";
import {
  PIPELINE_STEP_IDS,
  arraysEqual,
  type PipelineStepId,
} from "./automation-tab-helpers";

type ProjectMutator = (
  data?:
    | Project
    | undefined
    | ((current: Project | undefined) => Project | undefined),
  opts?: { revalidate?: boolean },
) => Promise<unknown>;

type UseAutomationTabActionsArgs = {
  projectId: string;
  savedAutoRun: boolean;
  savedKnownSkipSteps: PipelineStepId[];
  savedUnknownSkipSteps: string[];
  mutateLatest: () => Promise<unknown>;
  mutateRuns: () => Promise<unknown>;
  mutateProject: ProjectMutator;
};

export function useAutomationTabActions({
  projectId,
  savedAutoRun,
  savedKnownSkipSteps,
  savedUnknownSkipSteps,
  mutateLatest,
  mutateRuns,
  mutateProject,
}: UseAutomationTabActionsArgs) {
  const { toast } = useToast();
  const [isRerunning, setIsRerunning] = useState(false);
  const [healthResult, setHealthResult] =
    useState<PipelineHealthCheckResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    "rerun" | "health" | null
  >(null);
  const [autoRunOnCrawl, setAutoRunOnCrawl] = useState(savedAutoRun);
  const [skipSteps, setSkipSteps] =
    useState<PipelineStepId[]>(savedKnownSkipSteps);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    setAutoRunOnCrawl(savedAutoRun);
    setSkipSteps(savedKnownSkipSteps);
  }, [savedAutoRun, savedKnownSkipSteps]);

  const settingsDirty =
    autoRunOnCrawl !== savedAutoRun ||
    !arraysEqual(skipSteps, savedKnownSkipSteps);

  const handleRerun = useCallback(async () => {
    setIsRerunning(true);
    setActionError(null);
    setLastFailedAction(null);
    try {
      await api.projects.rerunAutoGeneration(projectId);
      await Promise.all([mutateLatest(), mutateRuns()]);
    } catch (err) {
      setLastFailedAction("rerun");
      setActionError(
        err instanceof Error ? err.message : "Could not rerun automation.",
      );
    } finally {
      setIsRerunning(false);
    }
  }, [mutateLatest, mutateRuns, projectId]);

  const handleHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setActionError(null);
    setLastFailedAction(null);
    try {
      const result = await api.pipeline.healthCheck(projectId);
      setHealthResult(result);
    } catch (err) {
      setLastFailedAction("health");
      setActionError(
        err instanceof Error ? err.message : "Could not run health check.",
      );
    } finally {
      setHealthLoading(false);
    }
  }, [projectId]);

  const handleSkipStepToggle = useCallback((stepId: PipelineStepId) => {
    setSkipSteps((prev) => {
      if (prev.includes(stepId)) return prev.filter((step) => step !== stepId);
      const selected = new Set([...prev, stepId]);
      return PIPELINE_STEP_IDS.filter((id) => selected.has(id));
    });
  }, []);

  const handleResetSettings = useCallback(() => {
    setAutoRunOnCrawl(savedAutoRun);
    setSkipSteps(savedKnownSkipSteps);
    setSettingsError(null);
  }, [savedAutoRun, savedKnownSkipSteps]);

  const handleSaveSettings = useCallback(async () => {
    setSettingsSaving(true);
    setSettingsError(null);

    const nextSettings = {
      autoRunOnCrawl,
      skipSteps: [...skipSteps, ...savedUnknownSkipSteps],
    };

    try {
      await api.pipeline.updateSettings(projectId, nextSettings);
      await mutateProject(
        (current) =>
          current
            ? {
                ...current,
                pipelineSettings: nextSettings,
              }
            : current,
        { revalidate: false },
      );
      toast({
        title: "Pipeline settings saved",
        description: "Automation defaults were updated for future runs.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not save pipeline settings.";
      setSettingsError(message);
      toast({
        title: "Failed to save settings",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSettingsSaving(false);
    }
  }, [
    autoRunOnCrawl,
    mutateProject,
    projectId,
    savedUnknownSkipSteps,
    skipSteps,
    toast,
  ]);

  const retryLastAction = useCallback(async () => {
    if (lastFailedAction === "rerun") {
      await handleRerun();
      return;
    }
    if (lastFailedAction === "health") {
      await handleHealthCheck();
    }
  }, [handleHealthCheck, handleRerun, lastFailedAction]);

  return {
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
  };
}
