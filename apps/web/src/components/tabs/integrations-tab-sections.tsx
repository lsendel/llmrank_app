import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StateMessage } from "@/components/ui/state";
import type { ProjectIntegration } from "@/lib/api";
import { BarChart3, Check, ExternalLink } from "lucide-react";
import {
  INTEGRATIONS,
  planAllows,
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function IntegrationHealthBanner({
  integrations,
}: {
  integrations: ProjectIntegration[] | undefined;
}) {
  if (!integrations || integrations.length === 0) return null;

  const connected = integrations.filter((i) => i.hasCredentials && i.enabled);
  const withErrors = connected.filter((i) => i.lastError);
  const lastSync = connected
    .map((i) => i.lastSyncAt)
    .filter((s): s is string => !!s)
    .sort()
    .pop();

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-2 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${
          withErrors.length > 0
            ? "bg-yellow-500"
            : connected.length > 0
              ? "bg-green-500"
              : "bg-gray-400"
        }`}
      />
      <span className="text-muted-foreground">
        {connected.length}/{integrations.length} connected
        {withErrors.length > 0 && ` · ${withErrors.length} with errors`}
        {lastSync && ` · last sync ${timeAgo(lastSync)} ago`}
      </span>
    </div>
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
    <div className="space-y-4">
      <IntegrationHealthBanner integrations={integrations} />
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
                      <p className="text-xs text-destructive mt-1">
                        Last sync error: {integration.lastError}
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
                        if (
                          meta.provider === "gsc" ||
                          meta.provider === "ga4"
                        ) {
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

export { IntegrationAnalyticsSection } from "./integrations-tab-analytics";
