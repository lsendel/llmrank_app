import { useCallback, useMemo } from "react";
import { useCompetitors, usePersonas } from "@/hooks/use-strategy";
import { api } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  buildCompetitorDomainSet,
  getRecommendedCompetitorDomains,
} from "./strategy-tab-helpers";

export function useStrategyTabData(projectId: string) {
  const { data: topicMap } = useApiSWR(
    `topic-map-${projectId}`,
    useCallback(() => api.strategy.getTopicMap(projectId), [projectId]),
  );

  const { competitors, addCompetitor, removeCompetitor } =
    useCompetitors(projectId);
  const {
    personas,
    generating,
    error: personaError,
    generatePersonas,
  } = usePersonas(projectId);

  const { data: persistedPersonas, mutate: mutatePersistedPersonas } =
    useApiSWR(
      `demand-personas-${projectId}`,
      useCallback(async () => {
        try {
          return await api.personas.list(projectId);
        } catch {
          return [];
        }
      }, [projectId]),
    );

  const { data: savedKeywords, mutate: mutateSavedKeywords } = useApiSWR(
    `demand-keywords-${projectId}`,
    useCallback(async () => {
      try {
        return await api.keywords.list(projectId);
      } catch {
        return [];
      }
    }, [projectId]),
  );

  const { data: visibilitySchedules, mutate: mutateVisibilitySchedules } =
    useApiSWR(
      `demand-schedules-${projectId}`,
      useCallback(async () => {
        try {
          return await api.visibility.schedules.list(projectId);
        } catch {
          return [];
        }
      }, [projectId]),
    );

  const { data: visibilityGaps } = useApiSWR(
    `demand-gaps-${projectId}`,
    useCallback(async () => {
      try {
        return await api.visibility.getGaps(projectId);
      } catch {
        return [];
      }
    }, [projectId]),
  );

  const competitorDomainSet = useMemo(
    () => buildCompetitorDomainSet(competitors),
    [competitors],
  );

  const recommendedCompetitorDomains = useMemo(() => {
    return getRecommendedCompetitorDomains({
      visibilityGaps,
      existingCompetitorDomains: competitorDomainSet,
    });
  }, [competitorDomainSet, visibilityGaps]);

  return {
    topicMap,
    competitors,
    addCompetitor,
    removeCompetitor,
    personas,
    generating,
    personaError,
    generatePersonas,
    persistedPersonas,
    savedKeywords,
    visibilitySchedules,
    recommendedCompetitorDomains,
    mutatePersistedPersonas,
    mutateSavedKeywords,
    mutateVisibilitySchedules,
  };
}
