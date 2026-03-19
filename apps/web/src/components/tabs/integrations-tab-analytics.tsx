import { IntegrationInsightsView } from "@/components/integration-insights-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateCard } from "@/components/ui/state";
import type { IntegrationInsights, ProjectIntegration } from "@/lib/api";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  MAX_SIGNAL_TASKS,
  type IntegrationDeltaMetric,
  type SignalTaskPlan,
} from "./integrations-tab-helpers";

export function IntegrationAnalyticsSection({
  integrationInsights,
  previousCrawlId,
  previousInsights,
  integrations,
  integrationDeltaMetrics,
  hasConnectedIntegrations,
  syncing,
  onSync,
  signalTaskPlan,
  autoPlanningSignals,
  onAutoPlanSignalTasks,
}: {
  integrationInsights: IntegrationInsights | undefined;
  previousCrawlId: string | null;
  previousInsights: IntegrationInsights | undefined;
  integrations: ProjectIntegration[] | undefined;
  integrationDeltaMetrics: IntegrationDeltaMetric[];
  hasConnectedIntegrations: boolean;
  syncing: boolean;
  onSync: () => void;
  signalTaskPlan: SignalTaskPlan;
  autoPlanningSignals: boolean;
  onAutoPlanSignalTasks: () => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Integration Analytics
              </CardTitle>
              <CardDescription
                title={integrationInsights?.crawlId ?? undefined}
              >
                {integrationInsights?.crawlId
                  ? `Based on crawl from ${new Date(integrationInsights.crawlDate ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : "Connect an integration and run a crawl to unlock insights."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasConnectedIntegrations && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSync}
                  disabled={syncing}
                  className="gap-1.5"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              )}
              {integrationInsights?.integrations && (
                <Badge variant="outline" className="h-6 gap-1 px-2 font-normal">
                  <Info className="h-3 w-3" />
                  Live Data
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {integrationInsights === undefined ? (
            <StateCard
              variant="loading"
              title="Loading integration insights"
              description="Fetching enrichment metrics and provider signals."
              contentClassName="p-0"
            />
          ) : !integrationInsights.integrations ? (
            <StateCard
              variant="empty"
              icon={
                <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
              }
              title="No integration insights yet"
              description="Connect at least one integration and complete a crawl to surface enrichment insights."
              cardClassName="border-2 border-dashed"
              contentClassName="p-0"
            />
          ) : (
            <IntegrationInsightsView
              insights={integrationInsights}
              connectedProviders={
                integrations
                  ?.filter(
                    (integration) =>
                      integration.hasCredentials && integration.enabled,
                  )
                  .map((integration) => integration.provider) ?? []
              }
            />
          )}
        </CardContent>
      </Card>

      {integrationInsights?.integrations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Insight Delta & Action Shortcuts
            </CardTitle>
            <CardDescription>
              Compare integration performance to the previous crawl and convert
              signal spikes into tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Delta since previous crawl</p>
              {!previousCrawlId ? (
                <p className="text-xs text-muted-foreground">
                  Run one more crawl to unlock trend comparisons between
                  integration snapshots.
                </p>
              ) : previousInsights === undefined ? (
                <p className="text-xs text-muted-foreground">
                  Loading previous crawl insights...
                </p>
              ) : integrationDeltaMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Not enough data for trend comparison yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {integrationDeltaMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="rounded-lg border bg-muted/20 p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {metric.currentValue}
                      </p>
                      <p
                        className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                          metric.direction === "positive"
                            ? "text-emerald-600"
                            : metric.direction === "negative"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {metric.direction === "positive" && (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                        {metric.direction === "negative" && (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {metric.deltaValue} vs previous
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Auto-plan tasks from integration signals
                  </p>
                  {signalTaskPlan.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No urgent integration anomalies detected right now.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {signalTaskPlan.items.length} recommended task
                      {signalTaskPlan.items.length === 1 ? "" : "s"} from GSC,
                      GA4, and Clarity signals.
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={onAutoPlanSignalTasks}
                  disabled={
                    autoPlanningSignals || signalTaskPlan.items.length === 0
                  }
                >
                  {autoPlanningSignals
                    ? "Planning tasks..."
                    : signalTaskPlan.items.length === 1
                      ? "Create 1 task"
                      : `Create up to ${Math.min(signalTaskPlan.items.length, MAX_SIGNAL_TASKS)} tasks`}
                </Button>
              </div>
              {signalTaskPlan.reasons.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {signalTaskPlan.reasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
