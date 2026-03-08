"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StateMessage } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { ShareOfVoiceChart } from "@/components/share-of-voice-chart";
import { CitedPagesTable } from "@/components/visibility/cited-pages-table";
import { BrandSentimentCard } from "@/components/visibility/brand-sentiment-card";
import { BrandPerceptionChart } from "@/components/visibility/brand-perception-chart";
import { BrandPerformanceDashboard } from "@/components/visibility/brand-performance-dashboard";
import { SourceOpportunitiesTable } from "@/components/visibility/source-opportunities-table";
import { PromptResearchPanel } from "@/components/visibility/prompt-research-panel";
import { CompetitorComparison } from "@/components/visibility/competitor-comparison";
import { AIVisibilityScoreHeader } from "@/components/visibility/ai-visibility-score-header";
import { RecommendationsCard } from "@/components/visibility/recommendations-card";
import { KeywordPicker } from "@/components/visibility/keyword-picker";
import { UpgradePrompt } from "@/components/upgrade-prompt";
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
  PROVIDERS,
  REGIONS,
  buildRegionFilter,
  filterKnownProviderIds,
  recommendedProvidersForIntent,
  type ProviderId,
  type ScheduleFrequency,
  type VisibilityIntent,
} from "./visibility-tab-helpers";
import {
  ScheduledChecksSection,
  ScheduleSuggestionBanner,
  VisibilityResultCard,
} from "./visibility-tab-sections";
import {
  confidenceFromVisibilityCoverage,
  relativeTimeLabel,
} from "@/lib/insight-metadata";
import { AlertTriangle } from "lucide-react";
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
      {/* Region Filter (Pro+) */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region:</span>
          <Select
            value={selectedRegion}
            onValueChange={(v) => {
              if (!canFilterRegion && v !== "all") {
                toast({
                  title: "Pro plan required",
                  description:
                    "Regional filtering is available on Pro and Agency plans.",
                  variant: "destructive",
                });
                return;
              }
              setSelectedRegion(v);
            }}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem
                  key={r.value}
                  value={r.value}
                  disabled={r.value !== "all" && !canFilterRegion}
                >
                  {r.label}
                  {r.value !== "all" && !canFilterRegion && " (Pro)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!historyLoaded && (
              <Badge variant="secondary">Loading visibility freshness...</Badge>
            )}
            {historyLoaded && !visibilityMeta && (
              <Badge variant="secondary">
                Run your first visibility check to establish confidence
              </Badge>
            )}
            {historyLoaded && visibilityMeta && (
              <>
                <Badge variant="secondary">
                  Last checked:{" "}
                  {relativeTimeLabel(visibilityMeta.latestCheckedAt)}
                </Badge>
                <Badge variant="secondary">
                  Checks sampled: {visibilityMeta.checks}
                </Badge>
                <Badge variant="secondary">
                  Provider diversity: {visibilityMeta.providerCount}/
                  {PROVIDERS.length}
                </Badge>
                <Badge variant="secondary">
                  Query coverage: {visibilityMeta.queryCount}
                </Badge>
                <Badge variant={visibilityMeta.confidence.variant}>
                  Confidence: {visibilityMeta.confidence.label}
                </Badge>
              </>
            )}
          </div>
          {historyLoaded && visibilityMeta && (
            <p className="text-xs text-muted-foreground">
              Confidence reflects repeated checks and source diversity.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as typeof mode)}
      >
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="run-monitor">Run &amp; Monitor</TabsTrigger>
          <TabsTrigger value="analyze-gaps">Analyze &amp; Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="run-monitor" className="space-y-6">
          {/* Run Check Form */}
          <KeywordPicker
            projectId={projectId}
            selectedIds={selectedKeywordIds}
            onSelectionChange={setSelectedKeywordIds}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run Visibility Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Query Intent</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={intent}
                    onValueChange={(value) =>
                      setIntent(value as VisibilityIntent)
                    }
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discovery">Brand discovery</SelectItem>
                      <SelectItem value="comparison">
                        Competitor comparison
                      </SelectItem>
                      <SelectItem value="transactional">
                        Transactional evaluation
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleApplyIntentPreset}
                  >
                    Apply Recommended Set
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommendations vary by intent and plan tier.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyProviderPreset(BALANCED_PRESET)}
                  >
                    Balanced (Recommended)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyProviderPreset(AI_SEARCH_PRESET)}
                  >
                    AI Search Focus
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!isProOrAbove}
                    onClick={() => {
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
                  >
                    Full Coverage {isProOrAbove ? "" : "(Pro+)"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>LLM Providers</Label>
                <div className="flex flex-wrap gap-2">
                  {PROVIDERS.map((p) => (
                    <Button
                      key={p.id}
                      variant={
                        selectedProviders.includes(p.id) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleProvider(p.id)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Cost indicator */}
              {selectedKeywordIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedKeywordIds.length} quer
                  {selectedKeywordIds.length === 1 ? "y" : "ies"} x{" "}
                  {selectedProviders.length} provider
                  {selectedProviders.length === 1 ? "" : "s"} ={" "}
                  {selectedKeywordIds.length * selectedProviders.length} checks
                </p>
              )}

              {error && (
                <StateMessage
                  variant="error"
                  compact
                  title="Visibility check failed"
                  description={error}
                  className="rounded-md border border-destructive/20 bg-destructive/5 py-3"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRunCheck}
                      disabled={
                        loading ||
                        selectedKeywordIds.length === 0 ||
                        selectedProviders.length === 0
                      }
                    >
                      Retry
                    </Button>
                  }
                />
              )}
              <Button
                onClick={handleRunCheck}
                disabled={loading || selectedKeywordIds.length === 0}
              >
                {loading ? "Checking..." : "Run Check"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Results</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((r) => (
                  <VisibilityResultCard key={r.id} check={r} />
                ))}
              </div>
            </div>
          )}

          {/* Schedule Suggestion Banner */}
          {results.length > 0 && schedules.length === 0 && (
            <ScheduleSuggestionBanner
              projectId={projectId}
              lastQuery={results[0]?.query ?? ""}
              lastProviders={selectedProviders}
              onCreated={(schedule) =>
                setSchedules((prev) => [...prev, schedule])
              }
            />
          )}

          {/* Scheduled Checks */}
          {schedulesLoaded && (
            <ScheduledChecksSection
              schedules={schedules}
              scheduleError={scheduleError}
              onCreateSchedule={handleCreateSchedule}
              onToggleSchedule={handleToggleSchedule}
              onDeleteSchedule={handleDeleteSchedule}
            />
          )}

          {/* History */}
          {historyLoaded && history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Previous Checks</h3>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Query</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Brand Mentioned</TableHead>
                      <TableHead>URL Cited</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((check) => (
                      <TableRow key={check.id}>
                        <TableCell className="text-sm">
                          {new Date(check.checkedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {check.query}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{check.llmProvider}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              check.brandMentioned ? "success" : "destructive"
                            }
                          >
                            {check.brandMentioned ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={check.urlCited ? "success" : "destructive"}
                          >
                            {check.urlCited ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analyze-gaps" className="space-y-6">
          {/* AI Visibility Score Header */}
          <AIVisibilityScoreHeader
            projectId={projectId}
            filters={regionFilter}
          />

          {/* Brand Performance Dashboard (Starter+) */}
          {!isFree && (
            <BrandPerformanceDashboard
              projectId={projectId}
              filters={regionFilter}
            />
          )}

          {isFree && (
            <UpgradePrompt
              feature="AI Visibility Tracking"
              description="Track how LLMs mention your brand across 25+ queries with scheduled monitoring."
              nextTier="Starter ($79/mo)"
              nextTierUnlocks="25 visibility checks, 5 scheduled queries, keyword discovery"
            />
          )}

          {/* Actionable Recommendations */}
          <RecommendationsCard projectId={projectId} filters={regionFilter} />

          {/* Platform Readiness Matrix */}
          {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

          {/* Share of Voice Chart */}
          <ShareOfVoiceChart projectId={projectId} filters={regionFilter} />

          {/* Cited Pages */}
          <CitedPagesTable projectId={projectId} filters={regionFilter} />

          {/* Brand Perception (Starter+) */}
          {!isFree && (
            <BrandSentimentCard projectId={projectId} filters={regionFilter} />
          )}

          {!isFree && (
            <BrandPerceptionChart
              projectId={projectId}
              filters={regionFilter}
            />
          )}

          {/* Competitor Comparison */}
          {history.length > 0 && competitors && (
            <CompetitorComparison
              projectId={projectId}
              results={history}
              competitorDomains={competitors.map((c) => c.domain)}
            />
          )}

          {/* Content Gaps */}
          {gaps && gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Content Gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gaps.map((gap) => (
                  <div
                    key={gap.query}
                    className="rounded-lg border border-warning/20 bg-warning/5 p-4"
                  >
                    <p className="text-sm font-medium">
                      &ldquo;{gap.query}&rdquo;
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Your status: Not mentioned</span>
                      <span>&bull;</span>
                      <span>
                        Competitors cited:{" "}
                        {gap.competitorsCited.map((c) => c.domain).join(", ")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Create content targeting this query to close the gap.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Prompt Research (Starter+) */}
          <PromptResearchPanel projectId={projectId} filters={regionFilter} />

          {/* Source Opportunities (Pro+) */}
          <SourceOpportunitiesTable
            projectId={projectId}
            filters={regionFilter}
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
