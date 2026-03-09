"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistSection } from "@/components/competitors/watchlist-section";
import { usePlan } from "@/hooks/use-plan";
import {
  RunVisibilitySection,
  VisibilityAnalyzeGapsSection,
  VisibilityFreshnessSummary,
  VisibilityRegionFilter,
} from "./visibility-tab-sections";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { useVisibilityTabActions } from "./use-visibility-tab-actions";
import { useVisibilityTabData } from "./use-visibility-tab-data";

export default function VisibilityTab({
  projectId,
  domain: _domain,
  latestCrawlId,
}: {
  projectId: string;
  domain: string;
  latestCrawlId?: string;
}) {
  const { isFree, isPro, isAgency, isProOrAbove } = usePlan();
  const canFilterRegion = isPro || isAgency;
  const {
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
  } = useVisibilityTabData({ projectId, canFilterRegion });
  const {
    mode,
    handleModeChange,
    handleSelectRegion,
    selectedKeywordIds,
    setSelectedKeywordIds,
    selectedProviders,
    intent,
    setIntent,
    results,
    loading,
    error,
    scheduleError,
    handleRunCheck,
    handleScheduleCreated,
    handleCreateSchedule,
    handleToggleSchedule,
    handleDeleteSchedule,
    handleApplyIntentPreset,
    handleApplyBalancedPreset,
    handleApplyAiSearchPreset,
    handleApplyFullCoveragePreset,
    toggleProvider,
  } = useVisibilityTabActions({
    projectId,
    canFilterRegion,
    isProOrAbove,
    regionFilter,
    setSelectedRegion,
    setHistory,
    setSchedules,
  });

  return (
    <div className="space-y-6">
      <VisibilityRegionFilter
        selectedRegion={selectedRegion}
        canFilterRegion={canFilterRegion}
        onSelectRegion={handleSelectRegion}
      />

      <VisibilityFreshnessSummary
        historyLoaded={historyLoaded}
        visibilityMeta={visibilityMeta}
      />

      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="run-monitor">Run &amp; Monitor</TabsTrigger>
          <TabsTrigger value="analyze-gaps">Analyze &amp; Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="run-monitor" className="space-y-6">
          <RunVisibilitySection
            projectId={projectId}
            selectedKeywordIds={selectedKeywordIds}
            onKeywordSelectionChange={setSelectedKeywordIds}
            intent={intent}
            onIntentChange={setIntent}
            onApplyIntentPreset={handleApplyIntentPreset}
            onApplyBalancedPreset={handleApplyBalancedPreset}
            onApplyAiSearchPreset={handleApplyAiSearchPreset}
            onApplyFullCoveragePreset={handleApplyFullCoveragePreset}
            isProOrAbove={isProOrAbove}
            selectedProviders={selectedProviders}
            onToggleProvider={toggleProvider}
            error={error}
            onRunCheck={handleRunCheck}
            loading={loading}
            results={results}
            schedules={schedules}
            onScheduleCreated={handleScheduleCreated}
            schedulesLoaded={schedulesLoaded}
            scheduleError={scheduleError}
            onCreateSchedule={handleCreateSchedule}
            onToggleSchedule={handleToggleSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            historyLoaded={historyLoaded}
            history={history}
          />
        </TabsContent>

        <TabsContent value="analyze-gaps" className="space-y-6">
          <VisibilityAnalyzeGapsSection
            projectId={projectId}
            latestCrawlId={latestCrawlId}
            filters={regionFilter}
            isFree={isFree}
            history={history}
            competitorDomains={competitorDomains}
            gaps={gaps}
          />
        </TabsContent>
      </Tabs>

      {/* Competitor Watchlist */}
      <WatchlistSection
        projectId={projectId}
        watchlistLimit={
          PLAN_LIMITS[
            (isFree
              ? "free"
              : isPro
                ? "pro"
                : isAgency
                  ? "agency"
                  : "starter") as keyof typeof PLAN_LIMITS
          ].watchlistQueriesPerProject
        }
      />
    </div>
  );
}
