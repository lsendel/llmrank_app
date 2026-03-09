import { useCallback, useMemo, useState } from "react";
import {
  api,
  type ScheduledQuery,
  type StrategyCompetitor,
  type VisibilityCheck,
  type VisibilityGap,
} from "@/lib/api";
import { confidenceFromVisibilityCoverage } from "@/lib/insight-metadata";
import { useApiSWR } from "@/lib/use-api-swr";
import { buildRegionFilter } from "./visibility-tab-helpers";

type UseVisibilityTabDataArgs = {
  projectId: string;
  canFilterRegion: boolean;
};

export function useVisibilityTabData({
  projectId,
  canFilterRegion,
}: UseVisibilityTabDataArgs) {
  const [selectedRegion, setSelectedRegion] = useState("all");

  const regionFilter = useMemo(
    () => buildRegionFilter(selectedRegion, canFilterRegion),
    [selectedRegion, canFilterRegion],
  );

  const { data: competitors } = useApiSWR<StrategyCompetitor[]>(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  const { data: gaps } = useApiSWR<VisibilityGap[]>(
    `visibility-gaps-${projectId}-${regionFilter?.region ?? "all"}-${regionFilter?.language ?? "all"}`,
    useCallback(
      () => api.visibility.getGaps(projectId, regionFilter),
      [projectId, regionFilter],
    ),
  );

  const {
    data: historyData,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useApiSWR<VisibilityCheck[]>(
    `visibility-history-${projectId}-${regionFilter?.region ?? "all"}-${regionFilter?.language ?? "all"}`,
    useCallback(
      () => api.visibility.list(projectId, regionFilter),
      [projectId, regionFilter],
    ),
  );

  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    mutate: mutateSchedules,
  } = useApiSWR<ScheduledQuery[]>(
    `visibility-schedules-${projectId}`,
    useCallback(() => api.visibility.schedules.list(projectId), [projectId]),
  );

  const history = useMemo(() => historyData ?? [], [historyData]);
  const historyLoaded = !historyLoading;
  const schedules = useMemo(() => schedulesData ?? [], [schedulesData]);
  const schedulesLoaded = !schedulesLoading;

  const setHistory = useCallback(
    (
      update:
        | VisibilityCheck[]
        | ((prev: VisibilityCheck[]) => VisibilityCheck[]),
    ) => {
      void mutateHistory((current) => {
        const prev = current ?? [];
        return typeof update === "function" ? update(prev) : update;
      }, false);
    },
    [mutateHistory],
  );

  const setSchedules = useCallback(
    (
      update: ScheduledQuery[] | ((prev: ScheduledQuery[]) => ScheduledQuery[]),
    ) => {
      void mutateSchedules((current) => {
        const prev = current ?? [];
        return typeof update === "function" ? update(prev) : update;
      }, false);
    },
    [mutateSchedules],
  );

  const visibilityMeta = useMemo(() => {
    if (history.length === 0) return null;

    const providers = new Set<string>();
    const queries = new Set<string>();
    let latestTimestamp: number | null = null;
    let latestCheckedAt: string | null = null;

    for (const check of history) {
      providers.add(check.llmProvider);
      queries.add(check.query);

      const timestamp = new Date(check.checkedAt).getTime();
      if (
        Number.isFinite(timestamp) &&
        (latestTimestamp == null || timestamp > latestTimestamp)
      ) {
        latestTimestamp = timestamp;
        latestCheckedAt = check.checkedAt;
      }
    }

    return {
      checks: history.length,
      providerCount: providers.size,
      queryCount: queries.size,
      latestCheckedAt,
      confidence: confidenceFromVisibilityCoverage(
        history.length,
        providers.size,
        queries.size,
      ),
    };
  }, [history]);

  const competitorDomains = useMemo(
    () => competitors?.map((competitor) => competitor.domain),
    [competitors],
  );

  return {
    selectedRegion,
    setSelectedRegion,
    regionFilter,
    history,
    setHistory,
    historyLoaded,
    schedules,
    setSchedules,
    schedulesLoaded,
    visibilityMeta,
    competitorDomains,
    gaps,
  };
}
