"use client";

import {
  CompetitorsActivitySection,
  CompetitorsBenchmarkSection,
  CompetitorsTabNavigation,
  CompetitorsTrendsSection,
} from "./competitors-tab-sections";
import { useCompetitorsTabActions } from "./use-competitors-tab-actions";
import { useCompetitorsTabData } from "./use-competitors-tab-data";

interface Props {
  projectId: string;
}

export function CompetitorsTab({ projectId }: Props) {
  const {
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
  } = useCompetitorsTabData({ projectId });
  const {
    activeTab,
    setActiveTab,
    newDomain,
    setNewDomain,
    benchmarking,
    error,
    lastFailedAction,
    rebenchmarkingId,
    togglingId,
    handleBenchmark,
    handleRebenchmark,
    handleToggleMonitoring,
    handleRetry,
  } = useCompetitorsTabActions({
    projectId,
    mutateBenchmarks,
    mutateStrategy,
  });

  return (
    <div className="space-y-6">
      <CompetitorsTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "benchmark" && (
        <CompetitorsBenchmarkSection
          projectId={projectId}
          isStarter={isStarter}
          isLoading={isLoading}
          newDomain={newDomain}
          benchmarking={benchmarking}
          error={error}
          hasRetryAction={lastFailedAction !== null}
          rebenchmarkingId={rebenchmarkingId}
          togglingId={togglingId}
          competitors={competitors}
          projectScores={projectScores}
          strategyByDomain={strategyByDomain}
          onDomainChange={setNewDomain}
          onBenchmark={handleBenchmark}
          onRetry={handleRetry}
          onRebenchmark={handleRebenchmark}
          onToggleMonitoring={handleToggleMonitoring}
        />
      )}

      {activeTab === "activity" && (
        <CompetitorsActivitySection
          projectId={projectId}
          competitorFeedLimit={limits.competitorFeedLimit}
          competitorDomains={competitorDomains}
        />
      )}

      {activeTab === "trends" && (
        <CompetitorsTrendsSection
          projectId={projectId}
          competitors={trendCompetitors}
          competitorTrendDays={limits.competitorTrendDays}
        />
      )}
    </div>
  );
}
