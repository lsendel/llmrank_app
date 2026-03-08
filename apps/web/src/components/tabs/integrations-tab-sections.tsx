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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCard, StateMessage } from "@/components/ui/state";
import type { IntegrationInsights, ProjectIntegration } from "@/lib/api";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  INTEGRATIONS,
  MAX_SIGNAL_TASKS,
  planAllows,
  type IntegrationDeltaMetric,
  type SignalTaskPlan,
  type SupportedProvider,
} from "./integrations-tab-helpers";

type IntegrationTestResult = {
  id: string;
  ok: boolean;
  message: string;
} | null;

type ConnectModalProvider = Exclude<SupportedProvider, "gsc" | "ga4">;

export type IntegrationConnectModalState = {
  provider: ConnectModalProvider;
  label: string;
} | null;

export function IntegrationStatusSection({
  connectedProvider,
  error,
  onRetrySync,
}: {
  connectedProvider?: SupportedProvider | null;
  error: string | null;
  onRetrySync: () => void | Promise<void>;
}) {
  const connectedLabel = connectedProvider
    ? (INTEGRATIONS.find((item) => item.provider === connectedProvider)
        ?.label ?? "Integration")
    : null;

  if (!connectedLabel && !error) {
    return null;
  }

  return (
    <>
      {connectedLabel && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {connectedLabel} connected successfully.
        </div>
      )}
      {error && (
        <StateMessage
          variant="error"
          compact
          title="Integration action failed"
          description={error}
          className="rounded-md border border-destructive/20 bg-destructive/5 py-3"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onRetrySync()}
            >
              Retry Sync
            </Button>
          }
        />
      )}
    </>
  );
}

export function IntegrationCardsSection({
  currentPlan,
  integrations,
  testing,
  disconnecting,
  testResult,
  onToggleIntegration,
  onTestIntegration,
  onDisconnectIntegration,
  onConnectOauth,
  onOpenConnectModal,
}: {
  currentPlan: string;
  integrations: ProjectIntegration[] | undefined;
  testing: string | null;
  disconnecting: string | null;
  testResult: IntegrationTestResult;
  onToggleIntegration: (integration: ProjectIntegration) => void;
  onTestIntegration: (integrationId: string) => void;
  onDisconnectIntegration: (integrationId: string) => void;
  onConnectOauth: (provider: "gsc" | "ga4") => void;
  onOpenConnectModal: (provider: ConnectModalProvider, label: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {INTEGRATIONS.map((meta) => {
        const integration = integrations?.find(
          (item) => item.provider === meta.provider,
        );
        const isConnected = !!integration?.hasCredentials;
        const isEnabled = integration?.enabled ?? false;
        const isLocked = !planAllows(currentPlan, meta.minPlan);
        const Icon = meta.icon;

        return (
          <Card key={meta.provider} className={isLocked ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLocked ? (
                    <Badge variant="secondary">
                      {meta.minPlan === "agency" ? "Agency" : "Pro"}+
                    </Badge>
                  ) : isConnected ? (
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        isEnabled
                          ? integration?.lastError
                            ? "bg-yellow-500"
                            : "bg-green-500"
                          : "bg-gray-400"
                      }`}
                      title={
                        isEnabled
                          ? integration?.lastError
                            ? "Error"
                            : "Connected"
                          : "Disabled"
                      }
                    />
                  ) : (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300"
                      title="Not connected"
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLocked ? (
                <p className="text-sm text-muted-foreground">
                  Upgrade to{" "}
                  <span className="font-medium text-foreground">
                    {meta.minPlan === "agency" ? "Agency" : "Pro"}
                  </span>{" "}
                  to unlock this integration.
                </p>
              ) : isConnected && integration ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {isEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => onToggleIntegration(integration)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {integration.lastSyncAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last synced:{" "}
                      {new Date(integration.lastSyncAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not yet synced — click Sync Now or run a crawl
                    </p>
                  )}
                  {integration.lastError && (
                    <p className="text-xs text-destructive">
                      {integration.lastError}
                    </p>
                  )}

                  {testResult?.id === integration.id && (
                    <div
                      className={`rounded-md p-2 text-xs ${
                        testResult.ok
                          ? "bg-green-500/10 text-green-700"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTestIntegration(integration.id)}
                      disabled={testing === integration.id}
                    >
                      {testing === integration.id
                        ? "Testing..."
                        : "Test Connection"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDisconnectIntegration(integration.id)}
                      disabled={disconnecting === integration.id}
                    >
                      {disconnecting === integration.id
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      What you&apos;ll get
                    </p>
                    <ul className="space-y-1">
                      {meta.dataCollected.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <Check className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Enhances your reports
                    </p>
                    <ul className="space-y-1">
                      {meta.reportEnhancements.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <BarChart3 className="h-3 w-3 mt-0.5 text-primary/60 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {meta.signupUrl && (
                    <p className="text-xs text-muted-foreground">
                      {meta.signupHint ? (
                        <a
                          href={meta.signupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {meta.signupHint}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <>
                          Don&apos;t have an account?{" "}
                          <a
                            href={meta.signupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            Sign up here
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (meta.provider === "gsc" || meta.provider === "ga4") {
                        onConnectOauth(meta.provider);
                        return;
                      }

                      onOpenConnectModal(meta.provider, meta.label);
                    }}
                  >
                    Connect
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function IntegrationConnectDialog({
  connectModal,
  apiKeyInput,
  clarityProjectId,
  metaAdAccountId,
  connecting,
  error,
  onApiKeyInputChange,
  onClarityProjectIdChange,
  onMetaAdAccountIdChange,
  onClose,
  onConnect,
  onMetaConnect,
}: {
  connectModal: IntegrationConnectModalState;
  apiKeyInput: string;
  clarityProjectId: string;
  metaAdAccountId: string;
  connecting: boolean;
  error: string | null;
  onApiKeyInputChange: (value: string) => void;
  onClarityProjectIdChange: (value: string) => void;
  onMetaAdAccountIdChange: (value: string) => void;
  onClose: () => void;
  onConnect: () => void;
  onMetaConnect: () => void;
}) {
  return (
    <Dialog
      open={!!connectModal}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {connectModal?.label}</DialogTitle>
          <DialogDescription>
            {connectModal?.provider === "meta" ? (
              <>
                Sign in with Facebook to connect Meta. Optionally add your Ad
                Account ID for ad performance data.
              </>
            ) : (
              <>
                Enter your API key to connect this integration.
                {connectModal?.provider === "psi" && (
                  <>
                    {" "}
                    <a
                      href="https://developers.google.com/speed/docs/insights/v5/get-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Get your API key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
                {connectModal?.provider === "clarity" && (
                  <>
                    <br />
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Steps to get your API token:
                    </span>
                    <ol className="mt-1 list-decimal pl-4 text-xs text-muted-foreground space-y-0.5">
                      <li>
                        Log in at{" "}
                        <a
                          href="https://clarity.microsoft.com/projects"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          clarity.microsoft.com
                          <ExternalLink className="h-3 w-3" />
                        </a>{" "}
                        and open your project.
                      </li>
                      <li>
                        Click the <strong>Settings</strong> gear in the top
                        navigation.
                      </li>
                      <li>
                        Go to <strong>Data Export</strong> in the left menu.
                      </li>
                      <li>
                        Click <strong>Generate new API token</strong>.
                      </li>
                      <li>
                        Give the token a name (4-32 chars), save, and copy it.
                      </li>
                    </ol>
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {connectModal?.provider !== "meta" && (
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKeyInput}
                onChange={(event) => onApiKeyInputChange(event.target.value)}
              />
            </div>
          )}
          {connectModal?.provider === "clarity" && (
            <div className="space-y-2">
              <Label htmlFor="clarity-project">Clarity Project ID</Label>
              <Input
                id="clarity-project"
                placeholder="Enter your Clarity project ID"
                value={clarityProjectId}
                onChange={(event) =>
                  onClarityProjectIdChange(event.target.value)
                }
              />
            </div>
          )}
          {connectModal?.provider === "meta" && (
            <div className="space-y-2">
              <Label htmlFor="meta-ad-account">
                Ad Account ID{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="meta-ad-account"
                placeholder="e.g. act_123456789"
                value={metaAdAccountId}
                onChange={(event) =>
                  onMetaAdAccountIdChange(event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                Find this in{" "}
                <a
                  href="https://business.facebook.com/settings/ad-accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Business Settings &gt; Ad Accounts
                  <ExternalLink className="h-3 w-3" />
                </a>
                . Required for ad performance data.
              </p>
            </div>
          )}
          {error && (
            <StateMessage
              variant="error"
              compact
              title="Could not connect integration"
              description={error}
              className="items-start py-2 text-left"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {connectModal?.provider === "meta" ? (
            <Button onClick={onMetaConnect}>Sign in with Facebook</Button>
          ) : (
            <Button onClick={onConnect} disabled={connecting || !apiKeyInput}>
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
              <CardDescription>
                {integrationInsights?.crawlId
                  ? `Derived from crawl: ${integrationInsights.crawlId}`
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
                  No overlapping provider data between the latest two crawls
                  yet.
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

      {hasConnectedIntegrations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              How integrations enhance your reports
            </CardTitle>
            <CardDescription>
              Connected integrations add real-world signals to your AI-readiness
              scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {INTEGRATIONS.map((meta) => {
                const integration = integrations?.find(
                  (item) => item.provider === meta.provider,
                );
                const isActive =
                  integration?.hasCredentials && integration?.enabled;
                const Icon = meta.icon;

                return (
                  <div
                    key={meta.provider}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      isActive ? "bg-primary/5 border-primary/20" : "opacity-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-md p-1.5 ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{meta.label}</p>
                        {isActive ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Not active
                          </span>
                        )}
                      </div>
                      <ul className="space-y-0.5">
                        {meta.reportEnhancements.slice(0, 2).map((item) => (
                          <li
                            key={item}
                            className="text-xs text-muted-foreground"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
