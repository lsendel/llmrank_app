import { useCallback, useMemo } from "react";
import { api, type VisibilityCheck, type VisibilityGap } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  buildKeywordRows,
  buildProviderMentionSummary,
  buildVisibilityMeta,
  calculateMentionRate,
  splitChecksByMode,
  type AIVisibilityScore,
  type BacklinkSummary,
} from "./ai-visibility-tab-helpers";

type UseAIVisibilityTabDataArgs = {
  projectId: string;
};

export function useAIVisibilityTabData({
  projectId,
}: UseAIVisibilityTabDataArgs) {
  const { data: score, isLoading: scoreLoading } = useApiSWR<AIVisibilityScore>(
    `ai-score-${projectId}`,
    useCallback(() => api.visibility.getAIScore(projectId), [projectId]),
  );

  const { data: checks } = useApiSWR<VisibilityCheck[]>(
    `vis-checks-${projectId}`,
    useCallback(() => api.visibility.list(projectId), [projectId]),
  );

  const { data: gaps } = useApiSWR<VisibilityGap[]>(
    `vis-gaps-${projectId}`,
    useCallback(() => api.visibility.getGaps(projectId), [projectId]),
  );

  const { data: blSummary, isLoading: blLoading } = useApiSWR<BacklinkSummary>(
    `backlinks-${projectId}`,
    useCallback(() => api.backlinks.getSummary(projectId), [projectId]),
  );

  const { llmChecks, aiModeChecks } = useMemo(
    () => splitChecksByMode(checks ?? []),
    [checks],
  );

  const llmMentionRate = useMemo(
    () => calculateMentionRate(llmChecks),
    [llmChecks],
  );
  const aiModeRate = useMemo(
    () => calculateMentionRate(aiModeChecks),
    [aiModeChecks],
  );
  const keywordRows = useMemo(() => buildKeywordRows(checks ?? []), [checks]);
  const visibilityMeta = useMemo(() => buildVisibilityMeta(checks), [checks]);
  const llmProviderSummary = useMemo(
    () => buildProviderMentionSummary(llmChecks),
    [llmChecks],
  );
  const llmProviderCount = useMemo(
    () => new Set(llmChecks.map((check) => check.llmProvider)).size,
    [llmChecks],
  );

  return {
    score,
    scoreLoading,
    checks,
    gaps,
    blSummary,
    blLoading,
    llmChecks,
    aiModeChecks,
    llmMentionRate,
    aiModeRate,
    keywordRows,
    visibilityMeta,
    llmProviderSummary,
    llmProviderCount,
  };
}
