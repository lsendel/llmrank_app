"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  ApiError,
  type ProjectIntegration,
  type BillingInfo,
} from "@/lib/api";

const INTEGRATIONS = [
  {
    provider: "gsc" as const,
    label: "Google Search Console",
    authType: "oauth2" as const,
    description: "Indexed pages, search queries, crawl stats",
    minPlan: "pro",
  },
  {
    provider: "psi" as const,
    label: "PageSpeed Insights",
    authType: "api_key" as const,
    description: "Core Web Vitals and lab performance scores",
    minPlan: "pro",
  },
  {
    provider: "ga4" as const,
    label: "Google Analytics 4",
    authType: "oauth2" as const,
    description: "Engagement metrics, bounce rate, sessions",
    minPlan: "agency",
  },
  {
    provider: "clarity" as const,
    label: "Microsoft Clarity",
    authType: "api_key" as const,
    description: "Heatmaps, dead clicks, rage clicks, scroll depth",
    minPlan: "agency",
  },
] as const;

const PLAN_ORDER = ["free", "starter", "pro", "agency"];

function planAllows(userPlan: string, requiredPlan: string): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

export default function IntegrationsTab({ projectId }: { projectId: string }) {
  const { withToken } = useApi();

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback((token: string) => api.billing.getInfo(token), []),
  );

  const { data: integrations, mutate: refreshIntegrations } = useApiSWR<
    ProjectIntegration[]
  >(
    `integrations-${projectId}`,
    useCallback(
      (token: string) => api.integrations.list(token, projectId),
      [projectId],
    ),
  );

  const currentPlan = billing?.plan ?? "free";

  // API key connect modal state
  const [connectModal, setConnectModal] = useState<{
    provider: "psi" | "clarity";
    label: string;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [clarityProjectId, setClarityProjectId] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Disconnect confirmation
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Test connection
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  function getIntegration(provider: string): ProjectIntegration | undefined {
    return integrations?.find((i) => i.provider === provider);
  }

  async function handleConnect() {
    if (!connectModal) return;
    setConnecting(true);
    setError(null);
    try {
      await withToken(async (token) => {
        await api.integrations.connect(token, projectId, {
          provider: connectModal.provider,
          apiKey: apiKeyInput,
          clarityProjectId:
            connectModal.provider === "clarity" ? clarityProjectId : undefined,
        });
      });
      setConnectModal(null);
      setApiKeyInput("");
      setClarityProjectId("");
      await refreshIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to connect integration.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleOAuthConnect(provider: "gsc" | "ga4") {
    setError(null);
    try {
      await withToken(async (token) => {
        const { url } = await api.integrations.startGoogleOAuth(
          token,
          projectId,
          provider,
        );
        window.location.href = url;
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to start OAuth flow.");
    }
  }

  async function handleToggle(integration: ProjectIntegration) {
    try {
      await withToken(async (token) => {
        await api.integrations.update(token, projectId, integration.id, {
          enabled: !integration.enabled,
        });
      });
      await refreshIntegrations();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDisconnect(integrationId: string) {
    setDisconnecting(integrationId);
    try {
      await withToken(async (token) => {
        await api.integrations.disconnect(token, projectId, integrationId);
      });
      await refreshIntegrations();
    } catch (err) {
      console.error(err);
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleTest(integrationId: string) {
    setTesting(integrationId);
    setTestResult(null);
    try {
      await withToken(async (token) => {
        const result = await api.integrations.test(
          token,
          projectId,
          integrationId,
        );
        setTestResult({ id: integrationId, ...result });
      });
    } catch (err) {
      setTestResult({
        id: integrationId,
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((meta) => {
          const integration = getIntegration(meta.provider);
          const isConnected = !!integration?.hasCredentials;
          const isEnabled = integration?.enabled ?? false;
          const isLocked = !planAllows(currentPlan, meta.minPlan);

          return (
            <Card key={meta.provider} className={isLocked ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {meta.description}
                    </p>
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
                ) : isConnected ? (
                  <>
                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={() => handleToggle(integration!)}
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

                    {/* Last sync / error */}
                    {integration?.lastSyncAt && (
                      <p className="text-xs text-muted-foreground">
                        Last synced:{" "}
                        {new Date(integration.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    {integration?.lastError && (
                      <p className="text-xs text-destructive">
                        {integration.lastError}
                      </p>
                    )}

                    {/* Test result */}
                    {testResult?.id === integration?.id && (
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

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(integration!.id)}
                        disabled={testing === integration?.id}
                      >
                        {testing === integration?.id
                          ? "Testing..."
                          : "Test Connection"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisconnect(integration!.id)}
                        disabled={disconnecting === integration?.id}
                      >
                        {disconnecting === integration?.id
                          ? "Disconnecting..."
                          : "Disconnect"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (
                        meta.authType === "oauth2" &&
                        (meta.provider === "gsc" || meta.provider === "ga4")
                      ) {
                        handleOAuthConnect(meta.provider);
                      } else {
                        setConnectModal({
                          provider: meta.provider as "psi" | "clarity",
                          label: meta.label,
                        });
                      }
                    }}
                  >
                    Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* API Key Connect Modal */}
      <Dialog
        open={!!connectModal}
        onOpenChange={(open) => {
          if (!open) {
            setConnectModal(null);
            setApiKeyInput("");
            setClarityProjectId("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {connectModal?.label}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
            </div>
            {connectModal?.provider === "clarity" && (
              <div className="space-y-2">
                <Label htmlFor="clarity-project">Clarity Project ID</Label>
                <Input
                  id="clarity-project"
                  placeholder="Enter your Clarity project ID"
                  value={clarityProjectId}
                  onChange={(e) => setClarityProjectId(e.target.value)}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting || !apiKeyInput}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
