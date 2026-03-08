"use client";

import type { SupportedProvider } from "./integrations-tab-helpers";
import {
  IntegrationAnalyticsSection,
  IntegrationCardsSection,
  IntegrationConnectDialog,
  IntegrationStatusSection,
} from "./integrations-tab-sections";
import { useIntegrationsTabActions } from "./use-integrations-tab-actions";
import { useIntegrationsTabData } from "./use-integrations-tab-data";

export default function IntegrationsTab({
  projectId,
  connectProvider,
  connectedProvider,
}: {
  projectId: string;
  connectProvider?: SupportedProvider | null;
  connectedProvider?: SupportedProvider | null;
}) {
  const {
    currentPlan,
    integrations,
    integrationInsights,
    previousCrawlId,
    previousInsights,
    hasConnectedIntegrations,
    integrationDeltaMetrics,
    signalTaskPlan,
    refreshIntegrations,
    refreshInsights,
  } = useIntegrationsTabData(projectId);

  const {
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
  } = useIntegrationsTabActions({
    projectId,
    currentPlan,
    connectProvider,
    integrations,
    signalTaskPlan,
    refreshIntegrations,
    refreshInsights,
  });

  return (
    <div className="space-y-6">
      <IntegrationStatusSection
        connectedProvider={connectedProvider}
        error={error}
        onRetrySync={handleRetrySync}
      />

      <IntegrationCardsSection
        currentPlan={currentPlan}
        integrations={integrations}
        testing={testing}
        disconnecting={disconnecting}
        testResult={testResult}
        onToggleIntegration={(integration) => void handleToggle(integration)}
        onTestIntegration={(integrationId) => void handleTest(integrationId)}
        onDisconnectIntegration={(integrationId) =>
          void handleDisconnect(integrationId)
        }
        onConnectOauth={(provider) => void handleOAuthConnect(provider)}
        onOpenConnectModal={openConnectModal}
      />

      <IntegrationAnalyticsSection
        integrationInsights={integrationInsights}
        previousCrawlId={previousCrawlId}
        previousInsights={previousInsights}
        integrations={integrations}
        integrationDeltaMetrics={integrationDeltaMetrics}
        hasConnectedIntegrations={hasConnectedIntegrations}
        syncing={syncing}
        onSync={() => void handleSync()}
        signalTaskPlan={signalTaskPlan}
        autoPlanningSignals={autoPlanningSignals}
        onAutoPlanSignalTasks={() => void handleAutoPlanSignalTasks()}
      />

      <IntegrationConnectDialog
        connectModal={connectModal}
        apiKeyInput={apiKeyInput}
        clarityProjectId={clarityProjectId}
        metaAdAccountId={metaAdAccountId}
        connecting={connecting}
        error={error}
        onApiKeyInputChange={setApiKeyInput}
        onClarityProjectIdChange={setClarityProjectId}
        onMetaAdAccountIdChange={setMetaAdAccountId}
        onClose={closeConnectModal}
        onConnect={() => void handleConnect()}
        onMetaConnect={handleMetaConnect}
      />
    </div>
  );
}
