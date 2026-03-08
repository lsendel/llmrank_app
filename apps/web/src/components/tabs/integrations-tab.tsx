"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateCard, StateMessage } from "@/components/ui/state";
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
import { useToast } from "@/components/ui/use-toast";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  ApiError,
  type CrawledPage,
  type ProjectIntegration,
  type BillingInfo,
  type IntegrationInsights,
} from "@/lib/api";
import { IntegrationInsightsView } from "@/components/integration-insights-view";
import { track } from "@/lib/telemetry";
import { useUser } from "@/lib/auth-hooks";
import {
  buildPageUrlLookup,
  dueAtDaysFromNow,
  formatDeltaNumber,
  INTEGRATIONS,
  isNonIndexedStatus,
  MAX_SIGNAL_TASKS,
  planAllows,
  resolvePageIdForSignalUrl,
  type IntegrationDeltaMetric,
  type SignalTaskDraft,
  type SupportedProvider,
  truncateUrlPath,
} from "./integrations-tab-helpers";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Info,
  RefreshCw,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function IntegrationsTab({
  projectId,
  connectProvider,
  connectedProvider,
}: {
  projectId: string;
  connectProvider?: SupportedProvider | null;
  connectedProvider?: SupportedProvider | null;
}) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const { user } = useUser();
  const currentUserId = user?.id ?? null;

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );

  const { data: integrations, mutate: refreshIntegrations } = useApiSWR<
    ProjectIntegration[]
  >(
    `integrations-${projectId}`,
    useCallback(() => api.integrations.list(projectId), [projectId]),
  );

  const { data: integrationInsights, mutate: refreshInsights } =
    useApiSWR<IntegrationInsights>(
      `integrations-insights-${projectId}`,
      useCallback(() => api.integrations.insights(projectId), [projectId]),
    );

  const { data: crawlHistory } = useApiSWR(
    `integrations-crawls-${projectId}`,
    useCallback(() => api.crawls.list(projectId, { limit: 2 }), [projectId]),
  );

  const latestCrawlId = integrationInsights?.crawlId ?? null;
  const previousCrawlId = useMemo(() => {
    const crawls = crawlHistory?.data ?? [];
    if (crawls.length < 2) return null;
    return crawls.find((crawl) => crawl.id !== latestCrawlId)?.id ?? null;
  }, [crawlHistory, latestCrawlId]);

  const { data: previousInsights } = useApiSWR<IntegrationInsights>(
    previousCrawlId
      ? `integrations-insights-previous-${projectId}-${previousCrawlId}`
      : null,
    useCallback(
      () => api.integrations.insights(projectId, previousCrawlId!),
      [projectId, previousCrawlId],
    ),
  );

  const { data: crawlPages } = useApiSWR<CrawledPage[]>(
    latestCrawlId ? `integration-pages-${latestCrawlId}` : null,
    useCallback(async () => {
      const pages = await api.pages.list(latestCrawlId!);
      return pages.data;
    }, [latestCrawlId]),
  );

  const currentPlan = billing?.plan ?? "free";

  // API key connect modal state
  const [connectModal, setConnectModal] = useState<{
    provider: "psi" | "clarity" | "meta";
    label: string;
  } | null>(null);
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
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

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [autoPlanningSignals, setAutoPlanningSignals] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const autoConnectAttempted = useRef<SupportedProvider | null>(null);

  const hasConnectedIntegrations = integrations?.some(
    (i) => i.hasCredentials && i.enabled,
  );

  const pageUrlLookup = useMemo(
    () => buildPageUrlLookup(crawlPages ?? []),
    [crawlPages],
  );

  const integrationDeltaMetrics = useMemo<IntegrationDeltaMetric[]>(() => {
    if (!integrationInsights?.integrations || !previousInsights?.integrations) {
      return [];
    }

    const metrics: IntegrationDeltaMetric[] = [];
    const current = integrationInsights.integrations;
    const previous = previousInsights.integrations;

    if (current.gsc && previous.gsc) {
      const clicks = formatDeltaNumber(
        current.gsc.totalClicks ?? 0,
        previous.gsc.totalClicks ?? 0,
        { higherIsBetter: true },
      );
      metrics.push({
        id: "gsc-clicks",
        label: "GSC Clicks",
        currentValue: clicks.currentValue,
        deltaValue: clicks.deltaValue,
        direction: clicks.direction,
      });

      const nonIndexedCurrent = current.gsc.indexedPages.filter((page) =>
        isNonIndexedStatus(page.status),
      ).length;
      const nonIndexedPrevious = previous.gsc.indexedPages.filter((page) =>
        isNonIndexedStatus(page.status),
      ).length;
      const nonIndexed = formatDeltaNumber(
        nonIndexedCurrent,
        nonIndexedPrevious,
        {
          higherIsBetter: false,
        },
      );
      metrics.push({
        id: "gsc-non-indexed",
        label: "Non-indexed pages",
        currentValue: nonIndexed.currentValue,
        deltaValue: nonIndexed.deltaValue,
        direction: nonIndexed.direction,
      });
    }

    if (current.ga4 && previous.ga4) {
      const bounce = formatDeltaNumber(
        current.ga4.bounceRate ?? 0,
        previous.ga4.bounceRate ?? 0,
        { decimals: 1, suffix: "%", higherIsBetter: false },
      );
      metrics.push({
        id: "ga4-bounce",
        label: "GA4 bounce rate",
        currentValue: bounce.currentValue,
        deltaValue: bounce.deltaValue,
        direction: bounce.direction,
      });
    }

    if (current.clarity && previous.clarity) {
      const uxScore = formatDeltaNumber(
        current.clarity.avgUxScore ?? 0,
        previous.clarity.avgUxScore ?? 0,
        { decimals: 1, higherIsBetter: true },
      );
      metrics.push({
        id: "clarity-ux",
        label: "Clarity UX score",
        currentValue: uxScore.currentValue,
        deltaValue: uxScore.deltaValue,
        direction: uxScore.direction,
      });
    }

    if (current.meta && previous.meta) {
      const currentEngagement =
        current.meta.totalShares +
        current.meta.totalReactions +
        current.meta.totalComments;
      const previousEngagement =
        previous.meta.totalShares +
        previous.meta.totalReactions +
        previous.meta.totalComments;
      const engagement = formatDeltaNumber(
        currentEngagement,
        previousEngagement,
        {
          higherIsBetter: true,
        },
      );
      metrics.push({
        id: "meta-engagement",
        label: "Meta engagement",
        currentValue: engagement.currentValue,
        deltaValue: engagement.deltaValue,
        direction: engagement.direction,
      });
    }

    return metrics;
  }, [integrationInsights, previousInsights]);

  const signalTaskPlan = useMemo(() => {
    const reasons: string[] = [];
    const items: SignalTaskDraft[] = [];
    const integrationsData = integrationInsights?.integrations;
    if (!integrationsData) {
      return { reasons, items };
    }

    const gsc = integrationsData.gsc;
    if (gsc) {
      const nonIndexedPages = gsc.indexedPages.filter((page) =>
        isNonIndexedStatus(page.status),
      );
      if (nonIndexedPages.length > 0) {
        reasons.push(
          `${nonIndexedPages.length} page${nonIndexedPages.length === 1 ? "" : "s"} are not indexed in Google.`,
        );
        const severity: "critical" | "warning" =
          nonIndexedPages.length >= 10 ? "critical" : "warning";
        const dueAt =
          severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7);
        let unmappedCount = 0;

        for (const page of nonIndexedPages.slice(0, 15)) {
          const pageId = resolvePageIdForSignalUrl(page.url, pageUrlLookup);
          if (!pageId) {
            unmappedCount += 1;
            continue;
          }
          items.push({
            pageId,
            issueCode: "INTEGRATION_GSC_NOT_INDEXED",
            status: "pending",
            severity,
            category: "technical",
            scoreImpact: severity === "critical" ? 10 : 8,
            title: `Fix Google indexing issue: ${truncateUrlPath(page.url)}`,
            description: `Google Search Console reported "${page.status}" for this page.`,
            assigneeId: currentUserId,
            dueAt,
          });
        }

        if (unmappedCount > 0) {
          items.push({
            issueCode: "INTEGRATION_GSC_NOT_INDEXED_UNMAPPED",
            status: "pending",
            severity,
            category: "technical",
            scoreImpact: 7,
            title: "Review non-indexed pages from Google Search Console",
            description: `${unmappedCount} non-indexed page URL${unmappedCount === 1 ? "" : "s"} could not be mapped to crawl pages.`,
            assigneeId: currentUserId,
            dueAt,
          });
        }
      }
    }

    const clarity = integrationsData.clarity;
    if (clarity && clarity.rageClickPages.length > 0) {
      reasons.push(
        `${clarity.rageClickPages.length} page${clarity.rageClickPages.length === 1 ? "" : "s"} have rage-click events in Clarity.`,
      );
      const severity: "critical" | "warning" =
        clarity.rageClickPages.length >= 6 ? "critical" : "warning";
      const dueAt =
        severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7);

      for (const url of clarity.rageClickPages.slice(0, 10)) {
        items.push({
          pageId: resolvePageIdForSignalUrl(url, pageUrlLookup),
          issueCode: "INTEGRATION_CLARITY_RAGE_CLICKS",
          status: "pending",
          severity,
          category: "performance",
          scoreImpact: severity === "critical" ? 8 : 6,
          title: `Investigate rage clicks: ${truncateUrlPath(url)}`,
          description:
            "Microsoft Clarity detected repeated rage clicks that indicate UX friction.",
          assigneeId: currentUserId,
          dueAt,
        });
      }
    }

    const ga4 = integrationsData.ga4;
    if (ga4 && ga4.bounceRate >= 65) {
      reasons.push(
        `GA4 bounce rate is ${ga4.bounceRate.toFixed(1)}%, above the 65% review threshold.`,
      );
      const severity: "critical" | "warning" =
        ga4.bounceRate >= 75 ? "critical" : "warning";
      items.push({
        issueCode: "INTEGRATION_GA4_HIGH_BOUNCE",
        status: "pending",
        severity,
        category: "content",
        scoreImpact: severity === "critical" ? 8 : 6,
        title: "Reduce bounce rate on top landing pages",
        description: `Current bounce rate is ${ga4.bounceRate.toFixed(1)}% with average engagement ${ga4.avgEngagement.toFixed(0)} seconds.`,
        assigneeId: currentUserId,
        dueAt:
          severity === "critical" ? dueAtDaysFromNow(3) : dueAtDaysFromNow(7),
      });
    }

    return { reasons, items };
  }, [integrationInsights, pageUrlLookup, currentUserId]);

  const getIntegration = useCallback(
    (provider: string): ProjectIntegration | undefined =>
      integrations?.find((i) => i.provider === provider),
    [integrations],
  );

  const handleOAuthConnect = useCallback(
    async (provider: "gsc" | "ga4" | "meta", adAccountId?: string) => {
      setError(null);
      try {
        await withAuth(async () => {
          if (provider === "meta") {
            const { url } = await api.integrations.startMetaOAuth(
              projectId,
              adAccountId,
            );
            window.location.href = url;
          } else {
            const { url } = await api.integrations.startGoogleOAuth(
              projectId,
              provider,
            );
            window.location.href = url;
          }
        });
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to start OAuth flow.");
      }
    },
    [projectId, withAuth],
  );

  useEffect(() => {
    if (!connectProvider) return;
    if (integrations === undefined) return;
    if (autoConnectAttempted.current === connectProvider) return;
    autoConnectAttempted.current = connectProvider;

    const targetMeta = INTEGRATIONS.find(
      (item) => item.provider === connectProvider,
    );
    if (!targetMeta) return;

    if (!planAllows(currentPlan, targetMeta.minPlan)) {
      setError(
        `${targetMeta.label} requires ${targetMeta.minPlan === "agency" ? "Agency" : "Pro"} plan.`,
      );
      return;
    }

    const existing = getIntegration(connectProvider);
    if (existing?.hasCredentials) return;

    if (
      targetMeta.authType === "oauth2" &&
      connectProvider !== "psi" &&
      connectProvider !== "clarity" &&
      connectProvider !== "meta"
    ) {
      handleOAuthConnect(connectProvider);
      return;
    }

    if (connectProvider === "meta") {
      setConnectModal({ provider: "meta", label: targetMeta.label });
      return;
    }

    setConnectModal({
      provider: connectProvider as "psi" | "clarity",
      label: targetMeta.label,
    });
  }, [
    connectProvider,
    currentPlan,
    getIntegration,
    handleOAuthConnect,
    integrations,
  ]);

  async function handleSync() {
    setSyncing(true);
    try {
      await withAuth(async () => {
        const result = await api.integrations.sync(projectId);

        const providers = result.providers ?? [];
        const failed = providers.filter((p) => !p.ok);
        const succeeded = providers.filter((p) => p.ok);

        let description = `${result.enrichmentCount} enrichment rows stored`;
        if (failed.length > 0) {
          const failMsgs = failed
            .map((p) => `${p.provider}: ${p.error}`)
            .join("; ");
          description += `. Errors: ${failMsgs}`;
        }

        toast({
          title:
            failed.length === 0
              ? "Sync complete"
              : succeeded.length > 0
                ? "Sync partially complete"
                : "Sync failed — no data fetched",
          description,
          variant:
            failed.length > 0 && succeeded.length === 0
              ? "destructive"
              : "default",
        });
        track("integration.synced", { projectId });
        await refreshIntegrations();
        await refreshInsights();
      });
    } catch (err) {
      toast({
        title: "Sync failed",
        description:
          err instanceof ApiError
            ? err.message
            : "Failed to sync integration data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleAutoPlanSignalTasks() {
    if (!projectId || signalTaskPlan.items.length === 0) return;

    setAutoPlanningSignals(true);
    const candidates = signalTaskPlan.items.slice(0, MAX_SIGNAL_TASKS);
    try {
      const result = await withAuth(() =>
        api.actionItems.bulkCreate({
          projectId,
          items: candidates,
        }),
      );

      const remaining = signalTaskPlan.items.length - candidates.length;
      const processed = result.created + result.updated;
      toast({
        title:
          processed > 0
            ? "Integration tasks planned"
            : "No integration task changes",
        description:
          processed > 0
            ? remaining > 0
              ? `Processed ${processed} tasks. ${remaining} additional recommendations remain.`
              : `Processed ${processed} tasks from integration signals.`
            : "Open tasks already exist for the current integration signals.",
      });
      track("integration.auto_plan_tasks", {
        projectId,
        candidates: candidates.length,
        created: result.created,
        updated: result.updated,
      });
    } catch (err) {
      toast({
        title: "Integration task planning failed",
        description:
          err instanceof ApiError
            ? err.message
            : "Could not create tasks from integration signals.",
        variant: "destructive",
      });
    } finally {
      setAutoPlanningSignals(false);
    }
  }

  async function handleConnect() {
    if (!connectModal) return;
    setConnecting(true);
    setError(null);
    try {
      await withAuth(async () => {
        await api.integrations.connect(projectId, {
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

  async function handleToggle(integration: ProjectIntegration) {
    try {
      await withAuth(async () => {
        await api.integrations.update(projectId, integration.id, {
          enabled: !integration.enabled,
        });
      });
      await refreshIntegrations();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to toggle integration",
        variant: "destructive",
      });
    }
  }

  async function handleDisconnect(integrationId: string) {
    setDisconnecting(integrationId);
    try {
      await withAuth(async () => {
        await api.integrations.disconnect(projectId, integrationId);
      });
      await refreshIntegrations();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleTest(integrationId: string) {
    const integration = integrations?.find((i) => i.id === integrationId);
    track("integration.tested", {
      integrationType: integration?.provider ?? "unknown",
    });
    setTesting(integrationId);
    setTestResult(null);
    try {
      await withAuth(async () => {
        const result = await api.integrations.test(projectId, integrationId);
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
      {connectedProvider && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {INTEGRATIONS.find((item) => item.provider === connectedProvider)
            ?.label ?? "Integration"}{" "}
          connected successfully.
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
              onClick={async () => {
                setError(null);
                await refreshIntegrations();
                await refreshInsights();
              }}
            >
              Retry Sync
            </Button>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((meta) => {
          const integration = getIntegration(meta.provider);
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

                    {/* Sync status */}
                    {integration?.lastSyncAt ? (
                      <p className="text-xs text-muted-foreground">
                        Last synced:{" "}
                        {new Date(integration.lastSyncAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not yet synced — click Sync Now or run a crawl
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
                  <div className="space-y-3">
                    {/* What you'll get */}
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

                    {/* Enhances your reports */}
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

                    {"signupUrl" in meta && meta.signupUrl && (
                      <p className="text-xs text-muted-foreground">
                        {"signupHint" in meta && meta.signupHint ? (
                          <>
                            <a
                              href={meta.signupUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                            >
                              {meta.signupHint}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
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
                          meta.authType === "oauth2" &&
                          (meta.provider === "gsc" || meta.provider === "ga4")
                        ) {
                          handleOAuthConnect(meta.provider);
                        } else if (meta.provider === "meta") {
                          setConnectModal({
                            provider: "meta",
                            label: meta.label,
                          });
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
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                  onClick={handleSync}
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
                  ?.filter((i) => i.hasCredentials && i.enabled)
                  .map((i) => i.provider) ?? []
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
                  onClick={() => void handleAutoPlanSignalTasks()}
                  disabled={
                    autoPlanningSignals || signalTaskPlan.items.length === 0
                  }
                >
                  {autoPlanningSignals
                    ? "Planning tasks..."
                    : `Create up to ${Math.min(
                        signalTaskPlan.items.length,
                        MAX_SIGNAL_TASKS,
                      )} tasks`}
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

      {/* How this data enhances your reports */}
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
                const integration = getIntegration(meta.provider);
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

      {/* API Key Connect Modal */}
      <Dialog
        open={!!connectModal}
        onOpenChange={(open) => {
          if (!open) {
            setConnectModal(null);
            setApiKeyInput("");
            setClarityProjectId("");
            setMetaAdAccountId("");
            setError(null);
          }
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
                  onChange={(e) => setApiKeyInput(e.target.value)}
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
                  onChange={(e) => setClarityProjectId(e.target.value)}
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
                  onChange={(e) => setMetaAdAccountId(e.target.value)}
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
            <Button
              variant="outline"
              onClick={() => {
                setConnectModal(null);
                setMetaAdAccountId("");
              }}
            >
              Cancel
            </Button>
            {connectModal?.provider === "meta" ? (
              <Button
                onClick={() => {
                  setConnectModal(null);
                  handleOAuthConnect("meta", metaAdAccountId || undefined);
                }}
              >
                Sign in with Facebook
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting || !apiKeyInput}
              >
                {connecting ? "Connecting..." : "Connect"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
