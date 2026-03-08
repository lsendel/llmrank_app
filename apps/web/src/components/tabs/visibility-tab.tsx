"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistSection } from "@/components/competitors/watchlist-section";
import { useToast } from "@/components/ui/use-toast";
import { usePlan } from "@/hooks/use-plan";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  ApiError,
  type VisibilityCheck,
  type VisibilityGap,
  type StrategyCompetitor,
  type ScheduledQuery,
} from "@/lib/api";
import {
  AI_SEARCH_PRESET,
  BALANCED_PRESET,
  DEFAULT_PROVIDER_IDS,
  FULL_COVERAGE_PRESET,
  buildRegionFilter,
  filterKnownProviderIds,
  recommendedProvidersForIntent,
  type ProviderId,
  type ScheduleFrequency,
  type VisibilityIntent,
} from "./visibility-tab-helpers";
import {
  RunVisibilitySection,
  VisibilityAnalyzeGapsSection,
  VisibilityFreshnessSummary,
  VisibilityRegionFilter,
} from "./visibility-tab-sections";
import { confidenceFromVisibilityCoverage } from "@/lib/insight-metadata";
import { PLAN_LIMITS } from "@llm-boost/shared";

export default function VisibilityTab({
  projectId,
  domain: _domain,
  latestCrawlId,
}: {
  projectId: string;
  domain: string;
  latestCrawlId?: string;
}) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const { isFree, isPro, isAgency, isProOrAbove } = usePlan();
  const [mode, setMode] = useState<"run-monitor" | "analyze-gaps">(
    "run-monitor",
  );
  const canFilterRegion = isPro || isAgency;
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] =
    useState<ProviderId[]>(DEFAULT_PROVIDER_IDS);
  const [intent, setIntent] = useState<VisibilityIntent>("discovery");
  const [results, setResults] = useState<VisibilityCheck[]>([]);
  const [history, setHistory] = useState<VisibilityCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute region/language filter for API calls
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

  // Scheduled checks state
  const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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

  // Load history on mount and when region changes
  useEffect(() => {
    setHistoryLoaded(false);
    withAuth(async () => {
      const data = await api.visibility.list(projectId, regionFilter);
      setHistory(data);
    })
      .catch((err: unknown) => {
        toast({
          title: "Failed to load history",
          description:
            err instanceof Error
              ? err.message
              : "Could not load visibility history",
          variant: "destructive",
        });
      })
      .finally(() => setHistoryLoaded(true));
  }, [withAuth, projectId, toast, regionFilter]);

  // Load schedules on mount
  useEffect(() => {
    withAuth(async () => {
      const data = await api.visibility.schedules.list(projectId);
      setSchedules(data);
    })
      .catch((err: unknown) => {
        toast({
          title: "Failed to load schedules",
          description:
            err instanceof Error
              ? err.message
              : "Could not load scheduled checks",
          variant: "destructive",
        });
      })
      .finally(() => setSchedulesLoaded(true));
  }, [withAuth, projectId, toast]);

  async function handleRunCheck() {
    if (selectedKeywordIds.length === 0 || selectedProviders.length === 0)
      return;
    setLoading(true);
    setError(null);
    try {
      // Separate real keyword IDs from persona virtual IDs
      const realIds: string[] = [];
      const personaQueries: string[] = [];
      for (const id of selectedKeywordIds) {
        if (id.startsWith("persona:")) {
          const query = id.split(":").slice(2).join(":");
          personaQueries.push(query);
        } else {
          realIds.push(id);
        }
      }

      // Save persona queries as keywords first
      if (personaQueries.length > 0) {
        const saved = await api.keywords.createBatch(projectId, personaQueries);
        realIds.push(...saved.map((k) => k.id));
      }

      await withAuth(async () => {
        const data = await api.visibility.run({
          projectId,
          keywordIds: realIds,
          providers: selectedProviders,
          ...(regionFilter && {
            region: regionFilter.region,
            language: regionFilter.language,
          }),
        });
        setResults(data);
      });

      const updated = await api.visibility.list(projectId, regionFilter);
      setHistory(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to run visibility check.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule(data: {
    query: string;
    providers: string[];
    frequency: ScheduleFrequency;
  }) {
    setScheduleError(null);
    try {
      await withAuth(async () => {
        const created = await api.visibility.schedules.create({
          projectId,
          ...data,
        });
        setSchedules((prev) => [...prev, created]);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setScheduleError(err.message);
      } else {
        setScheduleError("Failed to create schedule.");
      }
      throw err;
    }
  }

  async function handleToggleSchedule(schedule: ScheduledQuery) {
    try {
      await withAuth(async () => {
        const updated = await api.visibility.schedules.update(schedule.id, {
          enabled: !schedule.enabled,
        });
        setSchedules((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to toggle schedule",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteSchedule(id: string) {
    try {
      await withAuth(async () => {
        await api.visibility.schedules.delete(id);
        setSchedules((prev) => prev.filter((s) => s.id !== id));
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete schedule",
        variant: "destructive",
      });
    }
  }

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id as ProviderId)
        ? prev.filter((p) => p !== id)
        : [...prev, id as ProviderId],
    );
  }

  function applyProviderPreset(providers: readonly string[]) {
    setSelectedProviders(filterKnownProviderIds(providers));
  }

  function handleApplyIntentPreset() {
    const recommended = recommendedProvidersForIntent(intent, isProOrAbove);
    applyProviderPreset(recommended);
    toast({
      title: "Provider preset applied",
      description: `Loaded recommended providers for ${intent} intent.`,
    });
  }

  return (
    <div className="space-y-6">
      <VisibilityRegionFilter
        selectedRegion={selectedRegion}
        canFilterRegion={canFilterRegion}
        onSelectRegion={(value) => {
          if (!canFilterRegion && value !== "all") {
            toast({
              title: "Pro plan required",
              description:
                "Regional filtering is available on Pro and Agency plans.",
              variant: "destructive",
            });
            return;
          }
          setSelectedRegion(value);
        }}
      />

      <VisibilityFreshnessSummary
        historyLoaded={historyLoaded}
        visibilityMeta={visibilityMeta}
      />

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as typeof mode)}
      >
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
            onApplyBalancedPreset={() => applyProviderPreset(BALANCED_PRESET)}
            onApplyAiSearchPreset={() => applyProviderPreset(AI_SEARCH_PRESET)}
            onApplyFullCoveragePreset={() => {
              if (!isProOrAbove) {
                toast({
                  title: "Pro plan required",
                  description:
                    "Full coverage preset is available on Pro and Agency plans.",
                  variant: "destructive",
                });
                return;
              }
              applyProviderPreset(FULL_COVERAGE_PRESET);
            }}
            isProOrAbove={isProOrAbove}
            selectedProviders={selectedProviders}
            onToggleProvider={toggleProvider}
            error={error}
            onRunCheck={handleRunCheck}
            loading={loading}
            results={results}
            schedules={schedules}
            onScheduleCreated={(schedule) =>
              setSchedules((prev) => [...prev, schedule])
            }
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
            competitorDomains={competitors?.map(
              (competitor) => competitor.domain,
            )}
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
