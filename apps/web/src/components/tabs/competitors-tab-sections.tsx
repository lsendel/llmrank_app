import {
  Activity,
  BarChart3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { ActivityFeed } from "@/components/competitors/activity-feed";
import { TrendsView } from "@/components/competitors/trends-view";
import { CompetitorDiscoveryBanner } from "@/components/competitor-discovery-banner";
import { ContentGapAnalysis } from "@/components/content-gap-analysis";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StateCard, StateMessage } from "@/components/ui/state";
import { type CompetitorInsight, type StrategyCompetitor } from "@/lib/api";
import { cn, scoreColor } from "@/lib/utils";
import {
  ago,
  buildBenchmarkScoreRows,
  buildComparisonBadge,
  getStrategyCompetitorMeta,
  type BenchmarkCompetitor,
  type SubTab,
} from "./competitors-tab-helpers";

const SUB_TABS: { key: SubTab; label: string; icon: typeof Trophy }[] = [
  { key: "benchmark", label: "Benchmark", icon: Trophy },
  { key: "activity", label: "Activity Feed", icon: Activity },
  { key: "trends", label: "Trends", icon: BarChart3 },
];

export function CompetitorsTabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
}) {
  return (
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
            onClick={() => onTabChange(tab.key)}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

export function CompetitorsBenchmarkSection({
  projectId,
  isStarter,
  isLoading,
  newDomain,
  benchmarking,
  error,
  hasRetryAction,
  rebenchmarkingId,
  togglingId,
  competitors,
  competitorInsights,
  projectScores,
  strategyByDomain,
  onDomainChange,
  onBenchmark,
  onRetry,
  onRebenchmark,
  onToggleMonitoring,
}: {
  projectId: string;
  isStarter: boolean;
  isLoading: boolean;
  newDomain: string;
  benchmarking: boolean;
  error: string | null;
  hasRetryAction: boolean;
  rebenchmarkingId: string | null;
  togglingId: string | null;
  competitors: BenchmarkCompetitor[];
  competitorInsights: CompetitorInsight[];
  projectScores: Record<string, number> | undefined;
  strategyByDomain: Map<string, StrategyCompetitor>;
  onDomainChange: (value: string) => void;
  onBenchmark: () => void | Promise<void>;
  onRetry: () => void;
  onRebenchmark: (competitorId: string) => void | Promise<void>;
  onToggleMonitoring: (
    competitorId: string,
    currentlyEnabled: boolean,
  ) => void | Promise<void>;
}) {
  return (
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Competitor Benchmarking
          </CardTitle>
          <CardDescription>
            Compare your AI-readiness scores against competitors. Enter a domain
            to benchmark.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="competitor.com"
              value={newDomain}
              onChange={(event) => onDomainChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void onBenchmark()}
              disabled={benchmarking}
            />
            <Button
              onClick={() => void onBenchmark()}
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
                onClick: onRetry,
                label: "Retry action",
                disabled:
                  !hasRetryAction ||
                  benchmarking ||
                  rebenchmarkingId !== null ||
                  togglingId !== null,
              }}
            />
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <StateCard
          variant="loading"
          title="Loading competitor benchmarks"
          description="Fetching latest benchmark snapshots and monitoring status."
          contentClassName="p-0"
        />
      )}

      {!isLoading && competitors.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">No benchmarks yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter a competitor domain above to compare AI-readiness scores.
          </p>
        </div>
      )}

      {competitors.map((competitor) => (
        <CompetitorBenchmarkCard
          key={competitor.competitorDomain}
          competitor={competitor}
          projectScores={projectScores}
          strategyCompetitor={strategyByDomain.get(competitor.competitorDomain)}
          rebenchmarkingId={rebenchmarkingId}
          togglingId={togglingId}
          onRebenchmark={onRebenchmark}
          onToggleMonitoring={onToggleMonitoring}
        />
      ))}

      {competitors.length > 0 && (
        <CompetitorWinningQueriesSection insights={competitorInsights} />
      )}

      {competitors.length > 0 && (
        <CompetitorThemesSection insights={competitorInsights} />
      )}

      {competitors.length > 0 && <ContentGapAnalysis projectId={projectId} />}
    </>
  );
}

function CompetitorWinningQueriesSection({
  insights,
}: {
  insights: CompetitorInsight[];
}) {
  const rows = insights
    .flatMap((insight) =>
      insight.winningQueries.map((query) => ({
        competitorDomain: insight.competitorDomain,
        ...query,
      })),
    )
    .sort((a, b) => {
      if (a.yourMentioned !== b.yourMentioned) {
        return Number(a.yourMentioned) - Number(b.yourMentioned);
      }
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity);
    })
    .slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" />
          Top Competitor-Winning Queries
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <StateMessage
            variant="empty"
            compact
            title="No competitor query wins yet"
            description="Run visibility checks to see which prompts competitors are winning across AI providers."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={`${row.competitorDomain}-${row.query}`}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.query}</p>
                  <Badge variant="outline">{row.competitorDomain}</Badge>
                  <Badge
                    variant={row.yourMentioned ? "secondary" : "destructive"}
                  >
                    {row.yourMentioned ? "Overlap" : "Gap"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{row.wins} wins</span>
                  <span>
                    Best position{" "}
                    {row.bestPosition != null ? `#${row.bestPosition}` : "--"}
                  </span>
                  <span>
                    Avg. position{" "}
                    {row.avgPosition != null ? `#${row.avgPosition}` : "--"}
                  </span>
                  <span>
                    Last seen {new Date(row.lastSeenAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.providers.map((provider) => (
                    <Badge
                      key={provider}
                      variant="secondary"
                      className="text-xs"
                    >
                      {provider}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorThemesSection({
  insights,
}: {
  insights: CompetitorInsight[];
}) {
  const rows = insights.filter(
    (insight) =>
      insight.inferredThemes.length > 0 || insight.homepageSignals !== null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Inferred Messaging Themes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <StateMessage
            variant="empty"
            compact
            title="No inferred themes yet"
            description="Themes are inferred from competitor homepages and the queries they currently win."
          />
        ) : (
          <div className="space-y-4">
            {rows.map((insight) => (
              <div
                key={insight.competitorDomain}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {insight.competitorDomain}
                  </p>
                  {insight.homepageSignals?.title && (
                    <span className="text-xs text-muted-foreground">
                      {insight.homepageSignals.title}
                    </span>
                  )}
                </div>

                {insight.inferredThemes.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Homepage signals were fetched, but there was not enough
                    overlap with winning queries to infer stable themes yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {insight.inferredThemes.map((theme) => (
                      <div key={`${insight.competitorDomain}-${theme.label}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{theme.label}</Badge>
                          <span className="text-xs capitalize text-muted-foreground">
                            {theme.source}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {theme.evidence.map((evidence) => (
                            <Badge
                              key={`${theme.label}-${evidence}`}
                              variant="outline"
                              className="max-w-full text-xs"
                            >
                              {evidence}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorBenchmarkCard({
  competitor,
  projectScores,
  strategyCompetitor,
  rebenchmarkingId,
  togglingId,
  onRebenchmark,
  onToggleMonitoring,
}: {
  competitor: BenchmarkCompetitor;
  projectScores: Record<string, number> | undefined;
  strategyCompetitor?: StrategyCompetitor;
  rebenchmarkingId: string | null;
  togglingId: string | null;
  onRebenchmark: (competitorId: string) => void | Promise<void>;
  onToggleMonitoring: (
    competitorId: string,
    currentlyEnabled: boolean,
  ) => void | Promise<void>;
}) {
  const { competitorId, monitoringEnabled, lastBenchmarkAt } =
    getStrategyCompetitorMeta(strategyCompetitor);
  const comparisonBadge = buildComparisonBadge(
    competitor.comparison.overall ?? 0,
  );
  const scoreRows = buildBenchmarkScoreRows(projectScores, competitor);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {competitor.competitorDomain}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Benchmarked {new Date(competitor.crawledAt).toLocaleDateString()}
              {lastBenchmarkAt && (
                <span className="ml-2">
                  -- Last checked: {ago(lastBenchmarkAt)}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {competitorId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void onToggleMonitoring(competitorId, monitoringEnabled)
                }
                disabled={togglingId === competitorId}
                title={
                  monitoringEnabled ? "Disable monitoring" : "Enable monitoring"
                }
              >
                {togglingId === competitorId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Badge
                    variant={monitoringEnabled ? "success" : "secondary"}
                    className="text-xs"
                  >
                    {monitoringEnabled ? "Monitoring" : "Paused"}
                  </Badge>
                )}
              </Button>
            )}

            {competitorId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onRebenchmark(competitorId)}
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

            <Badge variant={comparisonBadge.variant}>
              {comparisonBadge.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {scoreRows.map((row) => (
            <div key={row.key} className="text-center">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span
                  className={cn("text-lg font-bold", scoreColor(row.yourScore))}
                >
                  {Math.round(row.yourScore)}
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    scoreColor(row.theirScore),
                  )}
                >
                  {Math.round(row.theirScore)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-0.5">
                {row.delta > 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : row.delta < 0 ? (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                ) : null}
                <span
                  className={cn(
                    "text-xs font-medium",
                    row.delta > 0
                      ? "text-success"
                      : row.delta < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {row.delta > 0 ? "+" : ""}
                  {Math.round(row.delta)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompetitorsActivitySection({
  projectId,
  competitorDomains,
  competitorFeedLimit,
}: {
  projectId: string;
  competitorDomains: string[];
  competitorFeedLimit: number;
}) {
  return (
    <ActivityFeed
      projectId={projectId}
      feedLimit={competitorFeedLimit}
      domains={competitorDomains}
    />
  );
}

export function CompetitorsTrendsSection({
  projectId,
  competitors,
  competitorTrendDays,
}: {
  projectId: string;
  competitors: Array<{ domain: string; id?: string }>;
  competitorTrendDays: number;
}) {
  return (
    <TrendsView
      projectId={projectId}
      competitors={competitors}
      competitorTrendDays={competitorTrendDays}
    />
  );
}
