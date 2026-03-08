import { useCallback, useMemo } from "react";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  extractFailedSteps,
  isRunSuccessful,
  normalizeKnownSkipSteps,
  normalizeUnknownSkipSteps,
} from "./automation-tab-helpers";

export function useAutomationTabData(projectId: string) {
  const { data: project, mutate: mutateProject } = useProject(projectId);

  const { data: latestRun, mutate: mutateLatest } = useApiSWR(
    `pipeline-latest-${projectId}`,
    useCallback(() => api.pipeline.latest(projectId), [projectId]),
  );

  const { data: runs, mutate: mutateRuns } = useApiSWR(
    `pipeline-runs-${projectId}`,
    useCallback(() => api.pipeline.list(projectId), [projectId]),
  );

  const savedAutoRun = project?.pipelineSettings?.autoRunOnCrawl !== false;
  const savedKnownSkipSteps = useMemo(
    () => normalizeKnownSkipSteps(project?.pipelineSettings?.skipSteps),
    [project?.pipelineSettings?.skipSteps],
  );
  const savedUnknownSkipSteps = useMemo(
    () => normalizeUnknownSkipSteps(project?.pipelineSettings?.skipSteps),
    [project?.pipelineSettings?.skipSteps],
  );
  const failedSteps = useMemo(
    () => extractFailedSteps(latestRun ?? null),
    [latestRun],
  );

  const { totalRuns, failedRuns, successRate } = useMemo(() => {
    const allRuns = runs ?? [];
    const successfulRuns = allRuns.filter(isRunSuccessful).length;
    const totalRuns = allRuns.length;

    return {
      totalRuns,
      failedRuns: allRuns.filter((run) => !isRunSuccessful(run)).length,
      successRate:
        totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
    };
  }, [runs]);

  return {
    latestRun,
    runs,
    savedAutoRun,
    savedKnownSkipSteps,
    savedUnknownSkipSteps,
    failedSteps,
    totalRuns,
    failedRuns,
    successRate,
    settingsReady: Boolean(project),
    mutateProject,
    mutateLatest,
    mutateRuns,
  };
}
