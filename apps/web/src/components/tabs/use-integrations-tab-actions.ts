import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { api, ApiError, type ProjectIntegration } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { track } from "@/lib/telemetry";
import {
  INTEGRATIONS,
  MAX_SIGNAL_TASKS,
  planAllows,
  type SignalTaskPlan,
  type SupportedProvider,
} from "./integrations-tab-helpers";
import { type IntegrationConnectModalState } from "./integrations-tab-sections";

type ConnectModalProvider =
  NonNullable<IntegrationConnectModalState>["provider"];
type IntegrationTestResult = {
  id: string;
  ok: boolean;
  message: string;
} | null;

type UseIntegrationsTabActionsArgs = {
  projectId: string;
  currentPlan: string;
  connectProvider?: SupportedProvider | null;
  integrations: ProjectIntegration[] | undefined;
  signalTaskPlan: SignalTaskPlan;
  refreshIntegrations: () => Promise<unknown>;
  refreshInsights: () => Promise<unknown>;
};

export function useIntegrationsTabActions({
  projectId,
  currentPlan,
  connectProvider,
  integrations,
  signalTaskPlan,
  refreshIntegrations,
  refreshInsights,
}: UseIntegrationsTabActionsArgs) {
  const { withAuth } = useApi();
  const { toast } = useToast();

  const [connectModal, setConnectModal] =
    useState<IntegrationConnectModalState>(null);
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [clarityProjectId, setClarityProjectId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<IntegrationTestResult>(null);
  const [syncing, setSyncing] = useState(false);
  const [autoPlanningSignals, setAutoPlanningSignals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConnectAttempted = useRef<SupportedProvider | null>(null);

  const closeConnectModal = useCallback(() => {
    setConnectModal(null);
    setApiKeyInput("");
    setClarityProjectId("");
    setMetaAdAccountId("");
    setError(null);
  }, []);

  const openConnectModal = useCallback(
    (provider: ConnectModalProvider, label: string) => {
      setConnectModal({ provider, label });
    },
    [],
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

    const existing = integrations?.find(
      (item) => item.provider === connectProvider,
    );
    if (existing?.hasCredentials) return;

    if (
      targetMeta.authType === "oauth2" &&
      connectProvider !== "psi" &&
      connectProvider !== "clarity" &&
      connectProvider !== "meta"
    ) {
      void handleOAuthConnect(connectProvider);
      return;
    }

    if (connectProvider === "meta") {
      openConnectModal("meta", targetMeta.label);
      return;
    }

    openConnectModal(connectProvider as ConnectModalProvider, targetMeta.label);
  }, [
    connectProvider,
    currentPlan,
    handleOAuthConnect,
    integrations,
    openConnectModal,
  ]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await withAuth(async () => {
        const result = await api.integrations.sync(projectId);

        const providers = result.providers ?? [];
        const failed = providers.filter((provider) => !provider.ok);
        const succeeded = providers.filter((provider) => provider.ok);

        let description = `${result.enrichmentCount} enrichment rows stored`;
        if (failed.length > 0) {
          const failMsgs = failed
            .map((provider) => `${provider.provider}: ${provider.error}`)
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
  }, [projectId, refreshInsights, refreshIntegrations, toast, withAuth]);

  const handleAutoPlanSignalTasks = useCallback(async () => {
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
  }, [projectId, signalTaskPlan, toast, withAuth]);

  const handleConnect = useCallback(async () => {
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
      closeConnectModal();
      await refreshIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to connect integration.");
    } finally {
      setConnecting(false);
    }
  }, [
    apiKeyInput,
    clarityProjectId,
    closeConnectModal,
    connectModal,
    projectId,
    refreshIntegrations,
    withAuth,
  ]);

  const handleMetaConnect = useCallback(() => {
    const adAccountId = metaAdAccountId || undefined;
    closeConnectModal();
    void handleOAuthConnect("meta", adAccountId);
  }, [closeConnectModal, handleOAuthConnect, metaAdAccountId]);

  const handleToggle = useCallback(
    async (integration: ProjectIntegration) => {
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
    },
    [projectId, refreshIntegrations, toast, withAuth],
  );

  const handleDisconnect = useCallback(
    async (integrationId: string) => {
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
    },
    [projectId, refreshIntegrations, toast, withAuth],
  );

  const handleTest = useCallback(
    async (integrationId: string) => {
      const integration = integrations?.find(
        (item) => item.id === integrationId,
      );
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
    },
    [integrations, projectId, withAuth],
  );

  const handleRetrySync = useCallback(async () => {
    setError(null);
    await refreshIntegrations();
    await refreshInsights();
  }, [refreshInsights, refreshIntegrations]);

  return {
    connectModal,
    metaAdAccountId,
    apiKeyInput,
    clarityProjectId,
    connecting,
    disconnecting,
    testing,
    testResult,
    syncing,
    autoPlanningSignals,
    error,
    setMetaAdAccountId,
    setApiKeyInput,
    setClarityProjectId,
    openConnectModal,
    closeConnectModal,
    handleOAuthConnect,
    handleSync,
    handleAutoPlanSignalTasks,
    handleConnect,
    handleMetaConnect,
    handleToggle,
    handleDisconnect,
    handleTest,
    handleRetrySync,
  };
}
