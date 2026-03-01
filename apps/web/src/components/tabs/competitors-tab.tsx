"use client";

import { useCallback, useState } from "react";
import {
  Plus,
  Trophy,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { cn, scoreColor } from "@/lib/utils";
import { StateCard, StateMessage } from "@/components/ui/state";
import { CompetitorDiscoveryBanner } from "@/components/competitor-discovery-banner";
import { ContentGapAnalysis } from "@/components/content-gap-analysis";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { ActivityFeed } from "@/components/competitors/activity-feed";
import { TrendsView } from "@/components/competitors/trends-view";
import { usePlan } from "@/hooks/use-plan";
import { PLAN_LIMITS } from "@llm-boost/shared";

interface Props {
  projectId: string;
}

type SubTab = "benchmark" | "activity" | "trends";

const SUB_TABS: { key: SubTab; label: string; icon: typeof Trophy }[] = [
  { key: "benchmark", label: "Benchmark", icon: Trophy },
  { key: "activity", label: "Activity Feed", icon: Activity },
  { key: "trends", label: "Trends", icon: BarChart3 },
];

function ago(d: string | null | undefined) {
  if (!d) return "Never";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

export function CompetitorsTab({ projectId }: Props) {
  const { withAuth } = useApi();
  const { plan, isStarter } = usePlan();
  const [activeTab, setActiveTab] = useState<SubTab>("benchmark");
  const [newDomain, setNewDomain] = useState("");
  const [benchmarking, setBenchmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const [rebenchmarkingId, setRebenchmarkingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const { data, isLoading, mutate } = useApiSWR(
    `benchmarks-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  // Also fetch strategy competitors to get IDs and monitoring fields
  const { data: strategyCompetitors, mutate: mutateStrategy } = useApiSWR(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  async function handleBenchmark() {
    if (!newDomain.trim()) return;
    setBenchmarking(true);
    setError(null);
    setLastFailedAction(null);
    try {
      await withAuth(() =>
        api.benchmarks.trigger({
          projectId,
          competitorDomain: newDomain.trim(),
        }),
      );
      setNewDomain("");
      mutate(); // refetch
      mutateStrategy();
    } catch (err: unknown) {
      setLastFailedAction(() => handleBenchmark);
      setError(
        err instanceof Error ? err.message : "Failed to benchmark competitor",
      );
    } finally {
      setBenchmarking(false);
    }
  }

  async function handleRebenchmark(competitorId: string) {
    setRebenchmarkingId(competitorId);
    setError(null);
    setLastFailedAction(null);
    try {
      await withAuth(() => api.competitorMonitoring.rebenchmark(competitorId));
      mutate();
    } catch (err: unknown) {
      setLastFailedAction(() => () => handleRebenchmark(competitorId));
      setError(err instanceof Error ? err.message : "Failed to re-benchmark");
    } finally {
      setRebenchmarkingId(null);
    }
  }

  async function handleToggleMonitoring(
    competitorId: string,
    currentlyEnabled: boolean,
  ) {
    setTogglingId(competitorId);
    setError(null);
    setLastFailedAction(null);
    try {
      await withAuth(() =>
        api.competitorMonitoring.updateMonitoring(competitorId, {
          enabled: !currentlyEnabled,
        }),
      );
      mutateStrategy();
    } catch (err: unknown) {
      setLastFailedAction(
        () => () => handleToggleMonitoring(competitorId, currentlyEnabled),
      );
      setError(
        err instanceof Error ? err.message : "Failed to update monitoring",
      );
    } finally {
      setTogglingId(null);
    }
  }

  const projectScores = data?.projectScores;
  const competitors = data?.competitors ?? [];
  const competitorDomains = competitors.map((c) => c.competitorDomain);

  // Build a lookup from domain to strategy competitor (for ID and monitoring fields)
  const strategyByDomain = new Map(
    (strategyCompetitors ?? []).map((sc) => [sc.domain, sc]),
  );

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex-1 gap-1.5",
                activeTab !== tab.key && "text-muted-foreground",
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* ── Benchmark sub-tab ───────────────────────────────── */}
      {activeTab === "benchmark" && (
        <>
          <CompetitorDiscoveryBanner projectId={projectId} />

          {isStarter && (
            <UpgradePrompt
              feature="Extended Competitor Analysis"
              description="Compare with up to 5 competitors and get AI-generated gap analysis."
              nextTier="Pro ($149/mo)"
              nextTierUnlocks="5 competitors, content gap analysis, scheduled crawls"
            />
          )}

          {/* Add competitor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Competitor Benchmarking
              </CardTitle>
              <CardDescription>
                Compare your AI-readiness scores against competitors. Enter a
                domain to benchmark.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="competitor.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBenchmark()}
                  disabled={benchmarking}
                />
                <Button
                  onClick={handleBenchmark}
                  disabled={benchmarking || !newDomain.trim()}
                >
                  {benchmarking ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" />
                  )}
                  {benchmarking ? "Benchmarking..." : "Benchmark"}
                </Button>
              </div>
              {error && (
                <StateMessage
                  variant="error"
                  compact
                  title="Competitor action failed"
                  description={error}
                  className="items-start py-3 text-left"
                  retry={{
                    onClick: () => {
                      if (lastFailedAction) {
                        void lastFailedAction();
                      }
                    },
                    label: "Retry action",
                    disabled:
                      lastFailedAction === null ||
                      benchmarking ||
                      rebenchmarkingId !== null ||
                      togglingId !== null,
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Loading state */}
          {isLoading && (
            <StateCard
              variant="loading"
              title="Loading competitor benchmarks"
              description="Fetching latest benchmark snapshots and monitoring status."
              contentClassName="p-0"
            />
          )}

          {/* Empty state */}
          {!isLoading && competitors.length === 0 && (
            <StateCard
              variant="empty"
              icon={<Trophy className="h-12 w-12 text-muted-foreground/30" />}
              title="No competitor benchmarks yet"
              description="Add a competitor domain above to start benchmarking and trend monitoring."
            />
          )}

          {/* Competitor cards */}
          {competitors.map((comp) => {
            const sc = strategyByDomain.get(comp.competitorDomain);
            const competitorId = sc?.id;
            const monitoringEnabled =
              (sc as Record<string, unknown> | undefined)?.monitoringEnabled !==
              false;
            const lastBenchmarkAt = (sc as Record<string, unknown> | undefined)
              ?.lastBenchmarkAt as string | null | undefined;

            return (
              <Card key={comp.competitorDomain}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {comp.competitorDomain}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Benchmarked{" "}
                        {new Date(comp.crawledAt).toLocaleDateString()}
                        {lastBenchmarkAt && (
                          <span className="ml-2">
                            -- Last checked: {ago(lastBenchmarkAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Monitoring toggle */}
                      {competitorId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleMonitoring(
                              competitorId,
                              monitoringEnabled,
                            )
                          }
                          disabled={togglingId === competitorId}
                          title={
                            monitoringEnabled
                              ? "Disable monitoring"
                              : "Enable monitoring"
                          }
                        >
                          {togglingId === competitorId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Badge
                              variant={
                                monitoringEnabled ? "success" : "secondary"
                              }
                              className="text-xs"
                            >
                              {monitoringEnabled ? "Monitoring" : "Paused"}
                            </Badge>
                          )}
                        </Button>
                      )}

                      {/* Re-benchmark button */}
                      {competitorId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRebenchmark(competitorId)}
                          disabled={rebenchmarkingId === competitorId}
                          title="Re-benchmark now"
                        >
                          {rebenchmarkingId === competitorId ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 h-4 w-4" />
                          )}
                          Re-benchmark
                        </Button>
                      )}

                      <Badge
                        variant={
                          (comp.comparison.overall ?? 0) > 0
                            ? "success"
                            : (comp.comparison.overall ?? 0) < 0
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {(comp.comparison.overall ?? 0) > 0
                          ? "You lead"
                          : (comp.comparison.overall ?? 0) < 0
                            ? "They lead"
                            : "Tied"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    {(
                      [
                        "overall",
                        "technical",
                        "content",
                        "aiReadiness",
                        "performance",
                      ] as const
                    ).map((cat) => {
                      const yourScore = projectScores?.[cat] ?? 0;
                      const theirScore = comp.scores[cat] ?? 0;
                      const delta = comp.comparison[cat] ?? 0;
                      const label =
                        cat === "aiReadiness"
                          ? "AI Readiness"
                          : cat.charAt(0).toUpperCase() + cat.slice(1);

                      return (
                        <div key={cat} className="text-center">
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span
                              className={cn(
                                "text-lg font-bold",
                                scoreColor(yourScore),
                              )}
                            >
                              {Math.round(yourScore)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              vs
                            </span>
                            <span
                              className={cn(
                                "text-lg font-bold",
                                scoreColor(theirScore),
                              )}
                            >
                              {Math.round(theirScore)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-center gap-0.5">
                            {delta > 0 ? (
                              <TrendingUp className="h-3 w-3 text-success" />
                            ) : delta < 0 ? (
                              <TrendingDown className="h-3 w-3 text-destructive" />
                            ) : null}
                            <span
                              className={cn(
                                "text-xs font-medium",
                                delta > 0
                                  ? "text-success"
                                  : delta < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                              )}
                            >
                              {delta > 0 ? "+" : ""}
                              {Math.round(delta)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Content Gap Analysis */}
          {competitors.length > 0 && (
            <ContentGapAnalysis projectId={projectId} />
          )}
        </>
      )}

      {/* ── Activity Feed sub-tab ──────────────────────────── */}
      {activeTab === "activity" && (
        <ActivityFeed
          projectId={projectId}
          feedLimit={limits.competitorFeedLimit}
          domains={competitorDomains}
        />
      )}

      {/* ── Trends sub-tab ─────────────────────────────────── */}
      {activeTab === "trends" && (
        <TrendsView
          projectId={projectId}
          competitors={competitors.map((c) => ({
            domain: c.competitorDomain,
            id: strategyByDomain.get(c.competitorDomain)?.id,
          }))}
          competitorTrendDays={limits.competitorTrendDays}
        />
      )}
    </div>
  );
}
