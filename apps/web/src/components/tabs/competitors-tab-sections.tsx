import {
  Activity,
  BarChart3,
  Loader2,
  Plus,
  RefreshCw,
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
import { type StrategyCompetitor } from "@/lib/api";
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
        <StateCard
          variant="empty"
          icon={<Trophy className="h-12 w-12 text-muted-foreground/30" />}
          title="No competitor benchmarks yet"
          description="Add a competitor domain above to start benchmarking and trend monitoring."
        />
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

      {competitors.length > 0 && <ContentGapAnalysis projectId={projectId} />}
    </>
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
