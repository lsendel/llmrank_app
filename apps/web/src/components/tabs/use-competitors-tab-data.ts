import { useCallback, useMemo } from "react";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { api, type StrategyCompetitor } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { usePlan } from "@/hooks/use-plan";
import {
  buildStrategyByDomain,
  buildTrendCompetitors,
  type BenchmarkListData,
} from "./competitors-tab-helpers";

type UseCompetitorsTabDataArgs = {
  projectId: string;
};

export function useCompetitorsTabData({
  projectId,
}: UseCompetitorsTabDataArgs) {
  const { plan, isStarter } = usePlan();
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const {
    data,
    isLoading,
    mutate: mutateBenchmarks,
  } = useApiSWR<BenchmarkListData>(
    `benchmarks-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  const { data: strategyCompetitors, mutate: mutateStrategy } = useApiSWR<
    StrategyCompetitor[]
  >(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  const projectScores = data?.projectScores;
  const competitors = useMemo(
    () => data?.competitors ?? [],
    [data?.competitors],
  );
  const competitorDomains = useMemo(
    () => competitors.map((competitor) => competitor.competitorDomain),
    [competitors],
  );
  const strategyByDomain = useMemo(
    () => buildStrategyByDomain(strategyCompetitors),
    [strategyCompetitors],
  );
  const trendCompetitors = useMemo(
    () => buildTrendCompetitors(competitors, strategyByDomain),
    [competitors, strategyByDomain],
  );

  return {
    isStarter,
    limits,
    isLoading,
    projectScores,
    competitors,
    competitorDomains,
    strategyByDomain,
    trendCompetitors,
    mutateBenchmarks,
    mutateStrategy,
  };
}
